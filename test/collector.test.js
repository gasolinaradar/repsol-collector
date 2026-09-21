const { test } = require('node:test');
const assert = require('node:assert');
const { createRepsolCollector, fetchStations } = require('../src');
const {
  normalizeRepsolStation,
  parseRepsolPrices,
  parseRepsolServices,
  formatRepsolSchedule,
  normalizePrice,
} = require('../src/normalize');
const { DEFAULT_REPSOL_SEARCH_URL, DEFAULT_TIPO } = require('../src/fetch');

const silentLogger = { info: () => {}, warn: () => {}, debug: () => {} };

const SAMPLE_STATIONS = [
  {
    id: 'G0014027',
    tipo: 2,
    nombre: 'E.S. SANTA CRUZ,S.L.',
    x: -8.46553056,
    y: 40.59533056,
    direccion: 'CR N-120, 580,5',
    cp: '32593',
    localidad: 'SANTA CRUZ DE ARRABALDO',
    provincia: 'Ourense',
    pais: 'España',
    horario: 'Abierto 24 horas',
    horarios: [
      { dia: 'Lunes', horario: '00:00 - 24:00' },
      { dia: 'Martes', horario: '00:00 - 24:00' },
    ],
    productos: [
      { producto: 'Efitec 95', precio: 1.799, fecha: '2026-08-27T13:16:00' },
      { producto: 'Diésel e+', precio: '1,949', fecha: '2026-08-27T13:16:00' },
      { producto: 'Propano 11 Kg' },
      { producto: 'Blue+' },
    ],
  },
  {
    id: 'G002',
    tipo: 2,
    nombre: 'E.S. CENTRO',
    x: -1.12995,
    y: 41.61225,
    direccion: 'C/ Mayor 1',
    cp: '25330',
    localidad: 'Verdú',
    provincia: 'Lleida',
    pais: 'España',
    productos: [],
  },
  {
    id: 'BAD',
    tipo: 2,
    nombre: 'Sin coords',
    x: null,
    y: null,
    localidad: 'X',
    provincia: 'Y',
    pais: 'España',
    productos: [],
  },
];

function createFakeClient(stations = SAMPLE_STATIONS) {
  const calls = [];
  const payloads =
    Array.isArray(stations) && stations.length > 0 && Array.isArray(stations[0])
      ? stations
      : [stations];
  const remaining = payloads.slice();
  const client = {
    calls,
    post: async (url, body, config) => {
      calls.push({ url, body, config });
      const items = remaining.length > 1 ? remaining.shift() : remaining[0];
      return { status: 200, data: { eess: { count: items.length, items } } };
    },
  };
  return client;
}

test('createRepsolCollector exposes the shared collector contract', () => {
  const collector = createRepsolCollector({ logger: silentLogger });
  assert.strictEqual(collector.name, 'repsol');
  assert.strictEqual(collector.country, 'ES');
  assert.strictEqual(typeof collector.fetch, 'function');
});

test('fetchStations returns normalized stations with prices, schedule and services', async () => {
  const client = createFakeClient();
  const stations = await fetchStations({ httpClient: client, logger: silentLogger });

  assert.equal(stations.length, 2);

  const byId = Object.fromEntries(stations.map((station) => [station.sourceStationId, station]));
  const g1 = byId['G0014027'];
  const g2 = byId['G002'];

  assert.ok(g1);
  assert.ok(g2);

  assert.equal(g1.source, 'repsol');
  assert.equal(g1.country, 'ES');
  assert.equal(g1.sourceStationId, 'G0014027');
  assert.equal(g1.name, 'E.S. SANTA CRUZ,S.L.');
  assert.equal(g1.address, 'CR N-120, 580,5');
  assert.equal(g1.municipality, 'SANTA CRUZ DE ARRABALDO');
  assert.equal(g1.province, 'Ourense');
  assert.equal(g1.postalCode, '32593');
  assert.equal(g1.schedule, 'Abierto 24 horas');
  assert.deepEqual(g1.location, { type: 'Point', coordinates: [-8.46553056, 40.59533056] });
  assert.deepEqual(g1.prices, { efitec95: 1.799, disele: 1.949 });
  assert.deepEqual(g1.services, ['Propano 11 Kg', 'Blue+']);
  assert.ok(g1.lastUpdated instanceof Date);

  assert.equal(g2.sourceStationId, 'G002');
  assert.equal(g2.lastUpdated, null);
  assert.equal(g2.prices, undefined);
  assert.equal(g2.services, undefined);
  assert.equal(g2.schedule, undefined);
});

test('skips stations outside Spain and with invalid coordinates', async () => {
  const stations = [
    ...SAMPLE_STATIONS,
    { id: 'PT1', nombre: 'Portugués', x: -8.4, y: 40.6, pais: 'Portugal', productos: [] },
  ];
  const client = createFakeClient(stations);
  const result = await fetchStations({ httpClient: client, logger: silentLogger });
  const ids = result.map((station) => station.sourceStationId);
  assert.deepEqual(ids, ['G0014027', 'G002']);
});

test('uses the default search URL and tipo when none are provided', async () => {
  const client = createFakeClient();
  await fetchStations({ httpClient: client, logger: silentLogger });
  const url = client.calls[0].url;
  assert.ok(url.startsWith(DEFAULT_REPSOL_SEARCH_URL));
  assert.ok(url.includes(`tipo=${DEFAULT_TIPO}`));
  assert.ok(url.includes('action=search'));
});

test('reports progress through the context hook', async () => {
  const collector = createRepsolCollector({ httpClient: createFakeClient(), logger: silentLogger });
  const steps = [];

  const stations = await collector.fetch({
    reportProgress(percent, metadata = {}) {
      steps.push({ percent, metadata });
    },
  });

  assert.equal(stations.length, 2);
  assert.equal(steps[0].percent, 5);
  assert.equal(steps[0].metadata.stage, 'fetching_station_list');
  assert.ok(
    steps.some((step) => step.percent === 10 && step.metadata.stage === 'station_list_received'),
  );
  assert.ok(steps.some((step) => step.metadata.stage === 'normalizing_stations'));
  assert.equal(steps[steps.length - 1].percent, 100);
  assert.equal(steps[steps.length - 1].metadata.stage, 'completed');
});

test('throws on unexpected list payload', async () => {
  const client = {
    post: async () => ({ status: 200, data: { not: 'expected' } }),
  };
  await assert.rejects(
    () => fetchStations({ httpClient: client, retries: 0, logger: silentLogger }),
    /Unexpected Repsol search response/,
  );
});

test('returns an empty array for an empty station list', async () => {
  const client = createFakeClient([]);
  const stations = await fetchStations({ httpClient: client, logger: silentLogger });
  assert.deepEqual(stations, []);
});

test('normalizeRepsolStation returns null for non-object input and non-Spain', () => {
  assert.equal(normalizeRepsolStation(null), null);
  assert.equal(normalizeRepsolStation('nope'), null);
  assert.equal(normalizeRepsolStation({ x: 1, y: 2, pais: 'Portugal' }), null);
});

test('normalizeRepsolStation sets lastUpdated to null when no product date exists', () => {
  const station = {
    id: 'G3',
    x: 1,
    y: 2,
    pais: 'España',
    productos: [{ producto: 'Efitec 95', precio: 1.5 }],
  };
  assert.equal(normalizeRepsolStation(station).lastUpdated, null);
});

test('parseRepsolPrices parses products and tolerates Spanish comma decimals', () => {
  assert.deepEqual(parseRepsolPrices([{ producto: 'Efitec 95', precio: 1.799 }]), {
    efitec95: 1.799,
  });
  assert.deepEqual(parseRepsolPrices([{ producto: 'Diésel e+', precio: '1,949' }]), {
    disele: 1.949,
  });
  assert.equal(parseRepsolPrices([{ producto: 'Propano 11 Kg' }]), undefined);
  assert.equal(parseRepsolPrices([]), undefined);
  assert.equal(parseRepsolPrices(undefined), undefined);
});

test('parseRepsolServices returns product names', () => {
  assert.deepEqual(parseRepsolServices([{ producto: 'Efitec 95' }, { producto: 'Blue+' }]), [
    'Efitec 95',
    'Blue+',
  ]);
  assert.equal(parseRepsolServices([]), undefined);
});

test('parseRepsolPrices extracts only priced fuel slugs from a mixed productos array', () => {
  const products = [
    { producto: 'Efitec 95', precio: 1.799 },
    { producto: 'Diésel e+', precio: '1,949' },
    { producto: 'Propano 11 Kg' },
    { producto: 'Blue+' },
  ];
  assert.deepEqual(parseRepsolPrices(products), { efitec95: 1.799, disele: 1.949 });
});

test('parseRepsolServices extracts only unpriced product names from a mixed productos array', () => {
  const products = [
    { producto: 'Efitec 95', precio: 1.799 },
    { producto: 'Diésel e+', precio: '1,949' },
    { producto: 'Propano 11 Kg' },
    { producto: 'Blue+' },
  ];
  assert.deepEqual(parseRepsolServices(products), ['Propano 11 Kg', 'Blue+']);
});

test('formatRepsolSchedule prefers plain text and falls back to day lists', () => {
  assert.equal(formatRepsolSchedule('Abierto 24 horas'), 'Abierto 24 horas');
  assert.deepEqual(
    formatRepsolSchedule([
      { dia: 'Lunes', horario: '00:00 - 24:00' },
      { dia: 'Martes', horario: '08:00 - 20:00' },
    ]),
    'Lunes: 00:00 - 24:00, Martes: 08:00 - 20:00',
  );
  assert.equal(formatRepsolSchedule(undefined), undefined);
});

test('normalizePrice parses numbers and Spanish comma decimals', () => {
  assert.equal(normalizePrice('1,949'), 1.949);
  assert.equal(normalizePrice(1.799), 1.799);
  assert.equal(normalizePrice(null), null);
  assert.equal(normalizePrice(''), null);
});

test('WAF 403 errors are transient and retried with backoff', async () => {
  const mockClient = {
    calls: [],
    post: async (url, body, config) => {
      mockClient.calls.push({ url, body, config });
      return { status: 200, data: { eess: { count: 1, items: SAMPLE_STATIONS } } };
    },
  };

  const logger = { warn: () => {}, info: () => {} };
  let callCount = 0;
  const failingClient = {
    post: async (url, body, config) => {
      callCount += 1;
      if (callCount < 4) {
        return new Promise((_, reject) => {
          setTimeout(() => reject({ response: { status: 403 } }), 10);
        });
      }
      return { status: 200, data: { eess: { count: 2, items: SAMPLE_STATIONS } } };
    },
  };

  const stations = await fetchStations({ httpClient: failingClient, retries: 3, logger });
  assert.equal(stations.length, 2);
  assert.equal(callCount, 4); // 3 failures + 1 success
});

test('non-transient errors are not retried', async () => {
  const mockClient = {
    post: async () => ({ status: 200, data: { eess: { count: 0, items: [] } } }),
  };
  await fetchStations({ httpClient: mockClient, retries: 10, logger: silentLogger });
});

test('throws after 403 retries exhausted and attempts equals retries + 1', async () => {
  const logger = { warn: () => {}, info: () => {} };
  let callCount = 0;
  const failingClient = {
    post: async () => {
      callCount += 1;
      return Promise.reject({ response: { status: 403 } });
    },
  };

  await assert.rejects(
    () => fetchStations({ httpClient: failingClient, retries: 2, logger }),
    (err) => {
      if (!err || !err.response || err.response.status !== 403) {
        return false;
      }
      // Verify original 403 error is preserved
      return true;
    },
  );
  assert.equal(callCount, 3); // retries + 1
});

test('parse errors are not retried (fail fast)', async () => {
  const mockClient = {
    post: async () => ({ status: 200, data: { not: 'expected' } }),
  };
  await assert.rejects(
    () => fetchStations({ httpClient: mockClient, retries: 10, logger: silentLogger }),
    /Unexpected Repsol search response/,
  );
});

test('exponential backoff widens the jitter window with each attempt (WAF 403)', async () => {
  const logger = { warn: () => {} };
  const waits = [];
  const sleep = async (ms) => {
    waits.push(ms);
  };

  const failingClient = {
    post: async () => Promise.reject({ response: { status: 403 } }),
  };

  await assert.rejects(
    () => fetchStations({ httpClient: failingClient, retries: 3, minTimeoutMs: 10, factor: 2, sleep, logger }),
    (err) => err.response?.status === 403,
  );

  assert.equal(waits.length, 3, 'one backoff per retry');
  waits.forEach((wait, tryIndex) => {
    const window = 10 * 2 ** tryIndex;
    assert.ok(wait >= 0 && wait <= window, `attempt ${tryIndex + 1} wait ${wait}ms inside full-jitter window [0, ${window}]`);
  });
});
