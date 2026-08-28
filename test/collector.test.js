const { test } = require('node:test');
const assert = require('node:assert');
const { createRepsolCollector } = require('../src');
const { normalizeRepsolStation } = require('../src/normalize');

const silentLogger = { info: () => {}, warn: () => {}, debug: () => {} };

test('createRepsolCollector exposes the shared collector contract', () => {
  const collector = createRepsolCollector({ logger: silentLogger });
  assert.strictEqual(collector.name, 'repsol');
  assert.strictEqual(collector.country, 'ES');
  assert.strictEqual(typeof collector.fetch, 'function');
});

test('normalizeRepsolStation returns the shared normalized shape', () => {
  const station = normalizeRepsolStation({
    id: 'REP-001',
    name: 'Repsol Ctra. N-II km 370',
    lon: 2.1,
    lat: 41.4,
  });
  assert.strictEqual(station.source, 'repsol');
  assert.strictEqual(station.country, 'ES');
  assert.strictEqual(station.sourceStationId, 'REP-001');
  assert.deepStrictEqual(station.location.coordinates, [2.1, 41.4]);
});

test('normalizeRepsolStation returns null for empty input', () => {
  assert.strictEqual(normalizeRepsolStation(null), null);
  assert.strictEqual(normalizeRepsolStation(undefined), null);
});
