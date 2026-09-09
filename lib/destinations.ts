import catalog from './data/destinations.json' with { type: 'json' };

export const DESTINATION_REGIONS = Object.freeze({
  AF: 'África', AN: 'Antártida', AS: 'Asia', EU: 'Europa',
  NA: 'Norteamérica y Caribe', OC: 'Oceanía', SA: 'Sudamérica',
});
export type DestinationRegion = keyof typeof DESTINATION_REGIONS;

export type AirportDestination = Readonly<{
  id: string;
  iata: string;
  name: string;
  airport: string;
  country: string;
  countryCode: string;
  region: DestinationRegion;
  regionName: string;
  latitude: number;
  longitude: number;
}>;

export class DestinationQueryError extends Error {
  readonly status = 400;
}

export const destinationSource = Object.freeze(catalog.source);
const countries = new Map(catalog.countries.map((country) => [country.code, country]));

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// The index is bounded by the bundled snapshot and built once, never from an external request.
const indexed = catalog.airports.map((airport) => {
  const country = countries.get(airport.countryCode)!;
  const destination: AirportDestination = Object.freeze({
    id: airport.id, iata: airport.iata, name: airport.name, airport: airport.airport,
    country: country.name, countryCode: country.code,
    region: airport.region as DestinationRegion,
    regionName: DESTINATION_REGIONS[airport.region as DestinationRegion],
    latitude: airport.latitude, longitude: airport.longitude,
  });
  return {
    destination,
    city: normalize(airport.name),
    search: normalize([airport.name, airport.airport, airport.iata, airport.countryCode,
      country.name, country.englishName, airport.keywords || ''].join(' ')),
  };
});

const byIata = new Map(indexed.map(({ destination }) => [destination.iata, destination]));
const countryCounts = new Map<string, number>();
const regionCounts = new Map<string, number>();
const countryRegions = new Map<string, Set<string>>();
for (const { destination } of indexed) {
  countryCounts.set(destination.countryCode, (countryCounts.get(destination.countryCode) || 0) + 1);
  regionCounts.set(destination.region, (regionCounts.get(destination.region) || 0) + 1);
  const regions = countryRegions.get(destination.countryCode) || new Set<string>();
  regions.add(destination.region);
  countryRegions.set(destination.countryCode, regions);
}

export const destinationFacets = Object.freeze({
  countries: Object.freeze(catalog.countries.map((country) => Object.freeze({
    code: country.code, name: country.name, region: country.region,
    regions: Object.freeze([...(countryRegions.get(country.code) || [])].sort()),
    count: countryCounts.get(country.code) || 0,
  }))),
  regions: Object.freeze(Object.entries(DESTINATION_REGIONS).map(([code, name]) => Object.freeze({
    code, name, count: regionCounts.get(code) || 0,
  }))),
});

export function findDestinationByIata(code: string): AirportDestination | null {
  return byIata.get(code.trim().toUpperCase()) || null;
}

function integerParameter(params: URLSearchParams, name: string, fallback: number, max: number): number {
  const raw = params.get(name);
  if (raw === null || raw === '') return fallback;
  if (!/^[1-9]\d{0,4}$/.test(raw)) throw new DestinationQueryError(`${name} debe ser un número entero positivo.`);
  const value = Number(raw);
  if (value > max) throw new DestinationQueryError(`${name} no puede superar ${max}.`);
  return value;
}

export function searchDestinations(params: URLSearchParams) {
  const rawQuery = params.get('q') || '';
  if (rawQuery.length > 100) throw new DestinationQueryError('La búsqueda no puede superar 100 caracteres.');
  const query = normalize(rawQuery);
  const tokens = query.split(' ').filter(Boolean);
  const country = (params.get('country') || '').trim().toUpperCase();
  const region = (params.get('region') || '').trim().toUpperCase();
  if (tokens.length > 12) throw new DestinationQueryError('Usa hasta 12 palabras para buscar un destino.');
  if (country && (!/^[A-Z]{2}$/.test(country) || !countries.has(country))) throw new DestinationQueryError('Selecciona un país válido del catálogo.');
  if (region && !Object.hasOwn(DESTINATION_REGIONS, region)) throw new DestinationQueryError('Selecciona una región válida del catálogo.');
  const page = integerParameter(params, 'page', 1, 10000);
  const limit = integerParameter(params, 'limit', 24, 60);
  const matches = indexed.filter(({ destination, search }) =>
    (!country || destination.countryCode === country) &&
    (!region || destination.region === region) &&
    tokens.every((token) => search.includes(token)),
  );
  // Exact airport codes and city names precede incidental matches in airport keywords.
  if (query) {
    const score = (entry: typeof indexed[number]) =>
      entry.destination.iata.toLowerCase() === query ? 0 :
      entry.city === query ? 1 : entry.city.startsWith(query) ? 2 : 3;
    matches.sort((a, b) => score(a) - score(b));
  }
  const total = matches.length;
  return {
    destinations: matches.slice((page - 1) * limit, page * limit).map((entry) => entry.destination),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total },
    facets: destinationFacets,
    source: destinationSource,
  };
}
