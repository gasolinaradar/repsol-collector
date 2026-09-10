const axios = require('axios');
const { normalizeRepsolStation } = require('./normalize');
const { retry } = require('./retry');

// Repsol public fuel station finder is served from AEM as a map SPA. The map loads every
// station in one bulk POST to the search middleware endpoint; the response groups all point
// types under entity keys, and fuel stations live under `eess.items` as `{ count, items }`.
// tipo=1 is Spain-only (tipo=2 is Portugal, tipo=1,2 returns both); the provider builds the
// Estaciones de servicio card against tipo=1, so that is the default here.
const DEFAULT_REPSOL_SEARCH_URL =
  'https://www.repsol.es/bin/repsol/searchmiddleware/station-search.json';
const DEFAULT_TIPO = '1';
const DEFAULT_LANGUAGE = 'ES';
const DEFAULT_TIMEOUT = 20000;
const DEFAULT_RETRIES = 3;

const BASE_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent':
    'Mozilla/5.0 (compatible; GasolinaRadar repsol-collector/1.0; +https://github.com/gasolinaradar/repsol-collector)',
  Origin: 'https://www.repsol.es',
  Referer: 'https://www.repsol.es/buscador-eess-y-puntos-de-recarga/',
};

function resolveLogger(loggerOption) {
  return loggerOption && typeof loggerOption.info === 'function' ? loggerOption : console;
}

function resolveHttpClient(httpClientOption) {
  return httpClientOption && typeof httpClientOption.post === 'function' ? httpClientOption : axios;
}

function resolveUrl(urlOption, fallback) {
  const value = typeof urlOption === 'function' ? urlOption() : urlOption;
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

async function fetchStationList(httpClient, logger, searchUrl, tipo, language, timeout) {
  const params = new URLSearchParams({
    action: 'search',
    idioma: language,
    tipo: tipo,
  });
  const url = `${searchUrl}${searchUrl.includes('?') ? '&' : '?'}${params.toString()}`;

  logger.info('Requesting Repsol station list', { url });
  const response = await httpClient.post(url, null, {
    headers: BASE_HEADERS,
    timeout,
  });

  const data = response && response.data;
  const eess = data && typeof data === 'object' ? data.eess : undefined;
  const items = eess && Array.isArray(eess.items) ? eess.items : undefined;

  if (!items) {
    throw new Error('Unexpected Repsol search response');
  }

  logger.info('Received Repsol station list', {
    url,
    status: response.status,
    stationCount: items.length,
  });

  return items;
}

async function fetchStations(options = {}, hooks = {}) {
  const logger = resolveLogger(options.logger);
  const httpClient = resolveHttpClient(options.httpClient);
  const searchUrl = resolveUrl(options.searchUrl, DEFAULT_REPSOL_SEARCH_URL);
  const tipo = options.tipo ?? DEFAULT_TIPO;
  const language = options.language ?? DEFAULT_LANGUAGE;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const reportProgress =
    typeof hooks.reportProgress === 'function' ? hooks.reportProgress : () => {};

  logger.info('Starting Repsol collector fetch');
  reportProgress(5, { stage: 'fetching_station_list' });
  const rawStations = await retry(
    () => fetchStationList(httpClient, logger, searchUrl, tipo, language, timeout),
    { retries, minTimeoutMs: 1000, logger },
  );
  const totalStations = rawStations.length;
  reportProgress(10, { stage: 'station_list_received', stationCount: totalStations });

  if (totalStations === 0) {
    reportProgress(100, { stage: 'completed', stationCount: 0 });
    return [];
  }

  const stations = [];
  for (let index = 0; index < totalStations; index += 1) {
    let normalized;
    try {
      normalized = normalizeRepsolStation(rawStations[index]);
    } catch (err) {
      logger.warn('Skipped Repsol station with invalid data', {
        error: err.message,
        index,
      });
      normalized = null;
    }
    if (normalized) {
      stations.push(normalized);
    }

    const progress = 10 + Math.round(((index + 1) / totalStations) * 90);
    reportProgress(progress > 100 ? 100 : progress, {
      stage: 'normalizing_stations',
      processed: index + 1,
      total: totalStations,
    });
  }

  reportProgress(100, { stage: 'completed', stationCount: stations.length });
  return stations;
}

module.exports = {
  fetchStations,
  fetchStationList,
  DEFAULT_REPSOL_SEARCH_URL,
  DEFAULT_TIPO,
  DEFAULT_LANGUAGE,
  BASE_HEADERS,
};
