// Normalizes a raw Repsol station payload into the shared @gasolinaradar station shape:
// {
//   source: 'repsol', country: 'ES', sourceStationId,
//   name, address, municipality, province, postalCode,
//   schedule, services,
//   location: { type: 'Point', coordinates: [lon, lat] },
//   prices, lastUpdated,
// }
// TODO(agent): implement parsing of the actual Repsol payload fields discovered during scraping.

function normalizeRepsolStation(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  return {
    source: 'repsol',
    country: 'ES',
    sourceStationId: raw.id ?? undefined,
    name: raw.name,
    location: {
      type: 'Point',
      coordinates: [Number(raw.lon), Number(raw.lat)],
    },
    lastUpdated: new Date(),
  };
}

module.exports = {
  normalizeRepsolStation,
};
