# @gasolinaradar/repsol-collector

Node.js collector para el buscador de estaciones de servicio de **Repsol** (España). Devuelve un array de estaciones normalizado, listo para **enriquecer** las fuentes primarias (p. ej. MITERD) vía `matching.enrichStations`.

Collector de Node.js para el **buscador de estaciones de servicio de Repsol** (España). Devuelve un array de estaciones normalizado listo para enriquecer las fuentes primarias (p. ej. MITERD) mediante `matching.enrichStations`.

```bash
npm install @gasolinaradar/repsol-collector
```

## Quick start / Inicio rápido

```js
const { createRepsolCollector } = require('@gasolinaradar/repsol-collector');

const collector = createRepsolCollector({ logger: console });
const stations = await collector.fetch({ reportProgress: (p) => {} });
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

## Tests

```bash
npm test
npm run test:live
```

## Legal / Legal

Los datos pertenecen a Repsol y se proporcionan "tal cual".

## License / Licencia

MIT. See [LICENSE](./LICENSE).
