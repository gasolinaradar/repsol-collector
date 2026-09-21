# @gasolinaradar/repsol-collector

Node.js collector para el buscador de estaciones de servicio de **Repsol** (España). Devuelve un array de estaciones normalizado, listo para **enriquecer** las fuentes primarias (p. ej. MITERD) vía `matching.enrichStations`.

Collector de Node.js para el **buscador de estaciones de servicio de Repsol** (España). Devuelve un array de estaciones normalizado listo para enriquecer las fuentes primarias (p. ej. MITERD) mediante `matching.enrichStations`.

## Fuente de datos / Data source

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

```bash
npm install @gasolinaradar/repsol-collector
```

## Quick start / Inicio rápido

```js
const { createRepsolCollector } = require('@gasolinaradar/repsol-collector');

const collector = createRepsolCollector({ logger: console });
const stations = await collector.fetch({ reportProgress: (p) => {} });

// Opcional: apuntar a otro host/endpoint o cambiar el tipo (país).
const collector = createRepsolCollector({
  logger: console,
  searchUrl: 'https://www.repsol.es/bin/repsol/searchmiddleware/station-search.json',
  tipo: '1', // '1' España, '2' Portugal, '1,2' ambos
  maxResponseSize: 50 * 1024 * 1024, // límite del body JSON (bytes), corta el fetch si se excede
  maxStations: 10000, // tope de estaciones; falla rápido antes de procesar respuestas gigantes
  batchSize: 500, // estaciones normalizadas por chunk
});
```

### Procesamiento por lotes / Chunked processing

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
  },
});
```

## Contract / Contrato

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

## Tests

```bash
npm test
npm run test:live   # opcional; golpea el endpoint real de Repsol
```

## Legal / Legal

Los datos pertenecen a Repsol y se proporcionan "tal cual".

## License / Licencia

MIT. See [LICENSE](./LICENSE).
