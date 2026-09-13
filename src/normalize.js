const decimalCommaRegex = /,/g;

function normalizePrice(value) {
  if (value === null || value === undefined) return null;
  const raw = typeof value === 'number' ? value.toString() : String(value).trim();
  if (!raw) return null;
  const normalized = raw.replace(decimalCommaRegex, '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCoordinate(value) {
  if (value === null || value === undefined) {
    throw new Error('Missing coordinate value');
  }

  const raw = typeof value === 'number' ? value.toString() : String(value).trim();
  if (!raw) {
    throw new Error('Empty coordinate value');
  }

  const normalized = raw.replace(decimalCommaRegex, '.');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid coordinate value: ${value}`);
  }

  return parsed;
}

function slugifyFuelName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '');
}

function cleanText(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeOptionalText(value) {
  const cleaned = cleanText(value);
  return cleaned.length > 0 ? cleaned : undefined;
}

function classifyProductEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return undefined;
  }
  const name = normalizeOptionalText(entry.producto);
  if (!name) {
    return undefined;
  }
  const amount = normalizePrice(entry.precio);
  if (amount === null) {
    return { kind: 'service', name };
  }
  return { kind: 'fuel', slug: slugifyFuelName(name), amount };
}

function parseRepsolPrices(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return undefined;
  }

  const prices = {};
  for (const entry of products) {
    const classified = classifyProductEntry(entry);
    if (
      classified &&
      classified.kind === 'fuel' &&
      classified.slug &&
      !Object.prototype.hasOwnProperty.call(prices, classified.slug)
    ) {
      prices[classified.slug] = classified.amount;
    }
  }

  return Object.keys(prices).length > 0 ? prices : undefined;
}

function parseRepsolServices(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return undefined;
  }

  const services = [];
  for (const entry of products) {
    const classified = classifyProductEntry(entry);
    if (classified && classified.kind === 'service') {
      services.push(classified.name);
    }
  }

  return services.length > 0 ? services : undefined;
}

function formatRepsolSchedule(schedule) {
  if (typeof schedule === 'string' && schedule.trim()) {
    return schedule.trim();
  }

  if (!Array.isArray(schedule) || schedule.length === 0) {
    return undefined;
  }

  const parts = schedule
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return undefined;
      }
      const day = normalizeOptionalText(entry.dia);
      const hours = normalizeOptionalText(entry.horario);
      if (!day || !hours) {
        return undefined;
      }
      return `${day}: ${hours}`;
    })
    .filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : undefined;
}

function latestProductDate(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return undefined;
  }

  let latest;
  for (const entry of products) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const raw = entry.fecha;
    const time = typeof raw === 'string' ? Date.parse(raw) : NaN;
    if (Number.isFinite(time) && (latest === undefined || time > latest)) {
      latest = time;
    }
  }

  return latest === undefined ? undefined : new Date(latest);
}

function normalizeRepsolStation(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  if (raw.pais && String(raw.pais).trim().toLowerCase() !== 'españa') {
    return null;
  }

  let latitude;
  let longitude;
  try {
    latitude = normalizeCoordinate(raw.y);
    longitude = normalizeCoordinate(raw.x);
  } catch (error) {
    return null;
  }

  const prices = parseRepsolPrices(raw.productos);
  const services = parseRepsolServices(raw.productos);
  const productDate = latestProductDate(raw.productos);

  return {
    source: 'repsol',
    country: 'ES',
    sourceStationId: raw.id ?? undefined,
    name: normalizeOptionalText(raw.nombre),
    address: normalizeOptionalText(raw.direccion),
    municipality: normalizeOptionalText(raw.localidad),
    province: normalizeOptionalText(raw.provincia),
    postalCode: normalizeOptionalText(raw.cp),
    schedule: formatRepsolSchedule(raw.horario ?? raw.horarios),
    services,
    location: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    prices,
    lastUpdated: productDate ?? new Date(),
  };
}

module.exports = {
  normalizePrice,
  normalizeCoordinate,
  slugifyFuelName,
  cleanText,
  normalizeOptionalText,
  parseRepsolPrices,
  parseRepsolServices,
  formatRepsolSchedule,
  normalizeRepsolStation,
};
