const axios = require('axios');
const { normalizeRepsolStation } = require('./normalize');
const { retry } = require('./retry');

// Repsol public fuel station finder (Spain).
// The SPA at https://www.repsol.es/buscador-eess-y-puntos-de-recarga loads stations via
// JSON endpoints (per-province routes like /zamora/, /zaragoza/ and/or a geobox search API).
// TODO(agent): discover and pin the real endpoint(s) + request shape by inspecting network calls.

const DEFAULT_REPSOL_SEARCH_URL = 'https://www.repsol.es/buscador-eess-y-puntos-de-recarga';
const DEFAULT_TIMEOUT = 15000;
const DEFAULT_RETRIES = 3;

const BASE_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'User-Agent':
    'Mozilla/5.0 (compatible; GasolinaRadar repsol-collector/1.0; +https://github.com/gasolinaradar/repsol-collector)',
  Referer: 'https://www.repsol.es/buscador-eess-y-puntos-de-recarga/',
};

function resolveLogger(loggerOption) {
  return loggerOption && typeof loggerOption.info === 'function' ? loggerOption : console;
}

function resolveHttpClient(httpClientOption) {
  return httpClientOption && typeof httpClientOption.get === 'function' ? httpClientOption : axios;
}

function resolveUrl(urlOption, fallback) {
  const value = typeof urlOption === 'function' ? urlOption() : urlOption;
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

async function fetchStations(options = {}, hooks = {}) {
  const logger = resolveLogger(options.logger);
  const httpClient = resolveHttpClient(options.httpClient);
  const searchUrl = resolveUrl(options.searchUrl, DEFAULT_REPSOL_SEARCH_URL);
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const reportProgress =
    typeof hooks.reportProgress === 'function' ? hooks.reportProgress : () => {};

  logger.info('Starting Repsol collector fetch');
  reportProgress(5, { stage: 'fetching_stations' });

  // TODO(agent): request all Repsol Spain stations, paginated or in bulk, parsing the JSON list.
  const rawStations = await retry(
    () => fetchStationList(httpClient, logger, searchUrl, timeout),
    { retries, minTimeoutMs: 1000, logger },
  );

  reportProgress(100, { stage: 'completed', stationCount: rawStations.length });
  return rawStations;
}

function fetchStationList() {
  throw new Error('fetchStationList not implemented yet');
}

module.exports = {
  fetchStations,
  fetchStationList,
  DEFAULT_REPSOL_SEARCH_URL,
};
