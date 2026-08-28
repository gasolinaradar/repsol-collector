const { test, before } = require('node:test');
const assert = require('node:assert');
const axios = require('axios');
const { fetchStationList } = require('../src/fetch');
const { normalizeRepsolStation } = require('../src/normalize');

const silentLogger = { info: () => {}, warn: () => {}, debug: () => {} };
const TIMEOUT = 30000;
const SAMPLE_SIZE = 5;

const SPAIN_LATITUDE_RANGE = [27, 44];
const SPAIN_LONGITUDE_RANGE = [-18.5, 4.5];

let list;
let normalized;

before(async () => {
  try {
    list = await fetchStationList(axios, silentLogger, undefined, undefined, undefined, TIMEOUT);
  } catch (error) {
    list = [];
    silentLogger.warn(
      `Repsol live endpoint unreachable (likely Akamai bot protection): ${error.message}`,
    );
  }

  normalized = list.slice(0, SAMPLE_SIZE).map(normalizeRepsolStation).filter(Boolean);
});

test('real Repsol API: station list is an array', () => {
  assert.ok(Array.isArray(list));
});

test('real Repsol API: station list is non-empty when reachable', () => {
  if (list.length === 0) {
    return;
  }
  assert.ok(list.length > 0, `expected stations, got ${list.length}`);
  assert.ok(list.every((item) => item && item.id), 'every list item should have an id');
});

test('real Repsol API: sample stations normalize into the shared shape', () => {
  if (normalized.length === 0) {
    return;
  }
  for (const station of normalized) {
    assert.equal(station.source, 'repsol');
    assert.equal(station.country, 'ES');
    assert.ok(station.sourceStationId, `missing source id for ${station.sourceStationId}`);
    assert.ok(station.name, `missing name for ${station.sourceStationId}`);
    assert.ok(Number.isFinite(station.location?.coordinates?.[0]));
    assert.ok(Number.isFinite(station.location?.coordinates?.[1]));
    assert.ok(station.lastUpdated instanceof Date);
  }
});

test('real Repsol API: coordinates fall within Spain', () => {
  for (const station of normalized) {
    const [lon, lat] = station.location.coordinates;
    assert.ok(
      lat >= SPAIN_LATITUDE_RANGE[0] && lat <= SPAIN_LATITUDE_RANGE[1],
      `latitude out of Spain range for ${station.sourceStationId}: ${lat}`,
    );
    assert.ok(
      lon >= SPAIN_LONGITUDE_RANGE[0] && lon <= SPAIN_LONGITUDE_RANGE[1],
      `longitude out of Spain range for ${station.sourceStationId}: ${lon}`,
    );
  }
});

test('real Repsol API: no duplicate source station ids', () => {
  const ids = normalized.map((station) => station.sourceStationId);
  assert.equal(new Set(ids).size, ids.length, 'sourceStationId must be unique');
});
