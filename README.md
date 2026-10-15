<div align="center">

<h1>@gasolinaradar/repsol-collector</h1>

<p>
  <b>Headless Node.js collector for the Repsol fuel-station finder (Spain).</b><br>
  <b>Collector headless de Node.js para el buscador de estaciones de Repsol (España).</b>
</p>

<p>
  <a href="https://www.npmjs.com/package/@gasolinaradar/repsol-collector"><img src="https://img.shields.io/npm/v/%40gasolinaradar%2Frepsol-collector" alt="npm version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="node >= 18"></a>
  <a href="https://github.com/gasolinaradar/repsol-collector/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome"></a>
  <img src="https://img.shields.io/badge/country-Spain-red.svg" alt="country: Spain">
</p>

<p>Devuelve un array de estaciones normalizado, listo para <b>enriquecer</b> las fuentes primarias (p. ej. MITERD) vía <code>matching.enrichStations</code>.<br>
Returns a normalized station array, ready to <b>enrich</b> primary sources (e.g. MITERD) via <code>matching.enrichStations</code>.</p>

</div>

## Contents / Índice

- [Features / Funcionalidades](#features--funcionalidades)
- [Installation / Instalación](#installation--instalación)
- [Quick start / Inicio rápido](#quick-start--inicio-rápido)
- [API](#api)
- [Configuration / Configuración](#configuration--configuración)
- [Data source / Fuente de datos](#data-source--fuente-de-datos)
- [Chunked processing / Procesamiento por lotes](#chunked-processing--procesamiento-por-lotes)
- [Station contract / Contrato de estación](#station-contract--contrato-de-estación)
- [Testing / Pruebas](#testing--pruebas)
- [Ecosystem / Ecosistema](#ecosystem--ecosistema)
- [Legal / Legal](#legal--legal)
- [License / Licencia](#license--licencia)

## Features / Funcionalidades

- Headless collector, no browser required / Collector headless, sin navegador.
- Single bulk POST per batch to the search middleware / Endpoint único por lote (un solo POST por lote).
- Normalized stations as GeoJSON / Estaciones normalizadas (GeoJSON).
- Chunked processing via `onBatch` / Procesamiento por lotes con `onBatch`.
- Response limits: `maxResponseSize`, `maxStations` / Límites de respuesta: `maxResponseSize`, `maxStations`.
- Country types: `tipo` `'1'` (Spain), `'2'` (Portugal), `'1,2'` (both) / Tipos de país: `tipo` `'1'` (España), `'2'` (Portugal), `'1,2'` (ambos).
- No dependencies other than axios / Sin dependencias salvo axios.
- Test suite on `node --test` / Suite de tests con `node --test`.

## Installation / Instalación

```bash
npm install @gasolinaradar/repsol-collector
```

## Quick start / Inicio rápido

```js
const { createRepsolCollector } = require('@gasolinaradar/repsol-collector');

const collector = createRepsolCollector({ logger: console });
const stations = await collector.fetch({ reportProgress: (p) => {} });

// Opcional: apuntar a otro host/endpoint o cambiar el tipo (país).
// Optional: point to another host/endpoint or change the country type.
const collector = createRepsolCollector({
  logger: console,
  searchUrl: 'https://www.repsol.es/bin/repsol/searchmiddleware/station-search.json',
  tipo: '1', // '1' España, '2' Portugal, '1,2' ambos / both
  maxResponseSize: 50 * 1024 * 1024, // límite del body JSON (bytes), corta el fetch si se excede / JSON body limit (bytes), aborts the fetch if exceeded
  maxStations: 10000, // tope de estaciones; falla rápido antes de procesar respuestas gigantes / station cap; fails fast before processing giant responses
  batchSize: 500, // estaciones normalizadas por chunk / normalized stations per chunk
});
```

## API

El paquete (`src/index.js`) exporta / The package (`src/index.js`) exports:

```js
const { createRepsolCollector, fetchStations } = require('@gasolinaradar/repsol-collector');
```

### `createRepsolCollector(options)`

Crea / Creates un collector que sigue el contrato compartido / that follows the shared contract:

```js
{ name: 'repsol', country: 'ES', fetch(context) }
```

`options` es un objeto opcional / is an optional object; ver / see [Configuration / Configuración](#configuration--configuración) for the full list of options and defaults.

### `collector.fetch({ reportProgress, onBatch })`

`async fetch(context)` → `Promise<Station[]>` — descarga el listado completo, lo normaliza en lotes y devuelve / downloads the full list, normalizes it in batches and returns the normalized stations.

- `reportProgress(percent, metadata)` — progreso 5 → 100 con `metadata.stage` (`fetching_station_list`, `station_list_received`, `normalizing_stations`, `completed`) / progress 5 → 100 with `metadata.stage`.
- `onBatch(batch, metadata)` — cada chunk de estaciones ya normalizadas, con `metadata = { batchIndex, processed, total }` / each chunk of already-normalized stations.

Ambos callbacks son opcionales / Both callbacks are optional. `fetchStations(options, hooks)` también está exportado para uso directo / is also exported for direct use.

## Configuration / Configuración

Todas las opciones son opcionales / All options are optional:

| Opción / Option | Tipo / Type | Default | Descripción / Description |
| --- | --- | --- | --- |
| `logger` | `{ info, warn }` | `console` | Logger con `info` y `warn` / Logger with `info` and `warn`; si no lo es, se usa `console` / falls back to `console`. |
| `searchUrl` | `string` \| `() => string` | `https://www.repsol.es/bin/repsol/searchmiddleware/station-search.json` | Endpoint del buscador / Search endpoint; acepta una función / accepts a function. |
| `tipo` | `'1'` \| `'2'` \| `'1,2'` | `'1'` | País / Country: `'1'` España (default), `'2'` Portugal, `'1,2'` ambos / both. |
| `language` | `string` | `'ES'` | Parámetro `idioma` de la petición / `idioma` request parameter. |
| `timeout` | `number` (ms) | `20000` | Timeout de la petición HTTP / HTTP request timeout. |
| `retries` | `number` | `3` | Reintentos con backoff ante errores transitorios (p. ej. WAF 403) / Retries with backoff on transient errors (e.g. WAF 403). |
| `maxResponseSize` | `number` (bytes) | `50 MB` (`50 * 1024 * 1024`) | Límite del body JSON; se pasa a axios como `maxContentLength`/`maxResponseSize` y aborta sin retry si se supera / JSON body limit, passed to axios as `maxContentLength`/`maxResponseSize`, aborts without retry when exceeded. |
| `maxStations` | `number` | `10000` | Tope de estaciones en el listado parseado; falla rápido antes de procesar respuestas gigantes (válido en cualquier cliente HTTP) / Station cap on the parsed listing; fails fast on giant responses (valid for any HTTP client). |
| `batchSize` | `number` | `500` | Estaciones normalizadas por chunk, entregadas vía `onBatch` / Normalized stations per chunk, delivered via `onBatch`. |
| `httpClient` | `{ post }` | `axios` | Cliente HTTP inyectable / Injectable HTTP client (p. ej. para tests / e.g. for tests). |

## Data source / Fuente de datos

El buscador de Repsol es una SPA (AEM) en `https://www.repsol.es/buscador-eess-y-puntos-de-recarga/`.
Cada entidad (estaciones, recarga, oficinas) se carga mediante **un único POST por lote** al endpoint interno:

```
POST https://www.repsol.es/bin/repsol/searchmiddleware/station-search.json
     ?action=search&idioma=ES&tipo=1
```

Referer: `https://www.repsol.es/buscador-eess-y-puntos-de-recarga/`, `Origin: https://www.repsol.es`.

- `action=search` devuelve todas las estaciones de un tipo en una sola respuesta.
- `tipo=1` = España (default); `tipo=2` = Portugal; `tipo=1,2` = ambos.
- Respuesta: `{ eess: { count, items: [...] }, recarga: {...}, ... }`. Las estaciones de
  servicio son `eess.items` (~3147 estaciones en España). Cada item incluye `id`, `nombre`,
  `x`/`y` (lon/lat), `direccion`, `cp`, `localidad`, `provincia`, `pais`, `horario`/`horarios`
  y `productos[]` con `precio`/`fecha`.

> ⚠️ Es un endpoint interno de una SPA: funciona con una llamada HTTP cruda (verificado con
> `axios`), pero al ser un endpoint no documentado puede cambiar de forma o aplicar
> rate-limiting. Si en producción empezara a devolver 4xx, se puede reutilizar una sesión o
> cookies de navegador obtenidas previamente.

## Chunked processing / Procesamiento por lotes

El endpoint devuelve toda la flota en **un único POST** (~3145 estaciones en España).
Para evitar timeout u OOM en respuestas grandes:

- `maxResponseSize` (default `50 MB`) se pasa a axios como `maxContentLength` /
  `maxResponseSize`; la petición se aborta sin retry si el body lo supera.
- `maxStations` (default `10000`) valida el tamaño del listado parseado en
  cualquier cliente HTTP, no solo axios.
- `batchSize` (default `500`) normaliza en chunks; cada chunk se entrega al
  consumidor a través de `context.onBatch(batch, metadata)`:

```js
const collector = createRepsolCollector({ logger: console });
await collector.fetch({
  reportProgress: (percent, metadata) => {},
  onBatch: (batch, metadata) => {
    // batch de estaciones ya normalizadas; útil para no acumular la flota en memoria
    // batch of already-normalized stations; useful to avoid holding the whole fleet in memory
  },
});
```

## Station contract / Contrato de estación

```js
{ name: 'repsol', country: 'ES', fetch(context) }
```

Cada estación normalizada sigue la forma compartida de `@gasolinaradar`:

```js
{
  source: 'repsol', country: 'ES', sourceStationId,
  name, address, municipality, province, postalCode,
  schedule, services,
  location: { type: 'Point', coordinates: [lon, lat] },
  prices, lastUpdated,
}
```

- `location.coordinates` es GeoJSON `[lon, lat]` (de los campos `x`/`y` del payload).
- `prices` mapea los combustibles con precio a `{ fuelSlug: amount }` (p. ej.
  `{ efitec95: 1.799, diéle: 1.949 }`), tolerando decimales con coma española.
- `schedule` usa el texto `horario` o formatea el array `horarios` por día.
- `services` recoge la disponibilidad de productos del item (`productos[].producto`).
- `lastUpdated` se toma de la fecha de precio más reciente, si existe.

## Testing / Pruebas

```bash
npm test           # node --test test/collector.test.js
npm run test:live  # opcional / optional; golpea el endpoint real de Repsol / hits the real Repsol endpoint
```

`npm run prepublishOnly` ejecuta `npm test` antes de publicar / runs `npm test` before publishing.

## Ecosystem / Ecosistema

- Homepage: <https://github.com/gasolinaradar/repsol-collector#readme>
- Issues / Incidencias: <https://github.com/gasolinaradar/repsol-collector/issues>
- Repository / Repositorio: <https://github.com/gasolinaradar/repsol-collector>
- npm: <https://www.npmjs.com/package/@gasolinaradar/repsol-collector>

## Legal / Legal

Los datos pertenecen a Repsol y se proporcionan "tal cual".

The data belongs to Repsol and is provided "as is". See [LEGAL.md](./LEGAL.md) for the full legal notice / consulta [LEGAL.md](./LEGAL.md) para el aviso legal completo.

## License / Licencia

MIT. See [LICENSE](./LICENSE). See also [LEGAL.md](./LEGAL.md).

MIT. Véase [LICENSE](./LICENSE). Véase también [LEGAL.md](./LEGAL.md).
