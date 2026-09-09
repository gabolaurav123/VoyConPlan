// Server-only transport. Client components may import types.ts with `import type`.
import type { TravelMode, TravelOffer, TravelSearchInput, TravelSearchResult, TravelSegment, TravelStatus } from './types.ts';

type Environment = {
  NODE_ENV?: string;
  APP_ORIGIN?: string;
  TRAVEL_SEARCH_ENABLED?: string;
  DUFFEL_ACCESS_TOKEN?: string;
  DUFFEL_MODE?: string;
  TRAVEL_SEARCH_DAILY_LIMIT?: string;
};
type ProviderObject = Record<string, unknown>;
const CACHE_SECONDS = 90;
const MAX_BODY_BYTES = 4096;
const MAX_PROVIDER_BYTES = 8 * 1024 * 1024;
const PROVIDER_URL = 'https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=8000';
const COVERAGE = 'Según rutas, aerolíneas y disponibilidad del proveedor.';

class TravelError extends Error {
  status: number;
  code: string;
  retryAfter?: number;
  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
const record = (value: unknown): ProviderObject | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as ProviderObject : null;
const boundedString = (value: unknown, max = 160): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value) ? value : null;
const code = (value: unknown): string | null => typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : null;
const placeCode = (value: unknown): string | null => code(record(value)?.iata_code);
const matchesPlace = (value: unknown, expected: string): boolean => {
  const place = record(value);
  return !!place && [place.iata_code, place.iata_city_code, record(place.city)?.iata_code].includes(expected);
};
const timestamp = (value: unknown): string | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
};
// Duffel's segment times are local airport times, often intentionally without a UTC offset.
const flightTime = (value: unknown): string | null =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
const duration = (value: unknown): string | null =>
  typeof value === 'string' && value.length < 40 && /^P(?=\d|T\d)(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/.test(value) ? value : null;

export function validateTravelSearch(value: unknown, now = Date.now()): TravelSearchInput {
  const input = record(value);
  const invalid = (message: string): never => { throw new TravelError(400, 'INVALID_SEARCH', message); };
  if (!input) return invalid('Escribe los datos de tu búsqueda.');
  if (Object.keys(input).some(key => !['origin', 'destination', 'departureDate', 'returnDate', 'adults', 'cabinClass', 'maxConnections'].includes(key)))
    return invalid('La búsqueda contiene campos no admitidos.');
  const origin = typeof input.origin === 'string' ? input.origin.trim().toUpperCase() : '';
  const destination = typeof input.destination === 'string' ? input.destination.trim().toUpperCase() : '';
  if (!code(origin) || !code(destination)) return invalid('Usa el código IATA de tres letras para origen y destino.');
  if (origin === destination) return invalid('El origen y el destino deben ser diferentes.');
  const today = new Date(now).toISOString().slice(0, 10);
  const lastDay = new Date(Date.parse(today) + 330 * 86400000).toISOString().slice(0, 10);
  const date = (value: unknown, name: string): string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid(`Indica una fecha válida de ${name}.`);
    const parsed = Date.parse(value + 'T00:00:00Z');
    if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value || value < today || value > lastDay)
      return invalid(`La fecha de ${name} debe estar entre hoy y los próximos 330 días.`);
    return value;
  };
  const departureDate = date(input.departureDate, 'ida');
  const returnDate = input.returnDate === undefined || input.returnDate === '' ? undefined : date(input.returnDate, 'regreso');
  if (returnDate && returnDate < departureDate) return invalid('El regreso no puede ser anterior a la ida.');
  if (typeof input.adults !== 'number' || !Number.isInteger(input.adults) || input.adults < 1 || input.adults > 9)
    return invalid('La búsqueda admite de 1 a 9 adultos.');
  const cabinClass = input.cabinClass ?? 'economy';
  if (typeof cabinClass !== 'string' || !['economy', 'premium_economy', 'business', 'first'].includes(cabinClass))
    return invalid('Selecciona una clase de cabina válida.');
  const maxConnections = input.maxConnections ?? 1;
  if (typeof maxConnections !== 'number' || !Number.isInteger(maxConnections) || maxConnections < 0 || maxConnections > 2)
    return invalid('Selecciona entre 0 y 2 conexiones.');
  return { origin, destination, departureDate, ...(returnDate ? { returnDate } : {}), adults: input.adults, cabinClass: cabinClass as TravelSearchInput['cabinClass'], maxConnections };
}

function normalizeOffer(value: unknown, query: TravelSearchInput, mode: TravelMode, consultedAt: string, now: number): TravelOffer | null {
  const offer = record(value);
  if (!offer || offer.live_mode !== (mode === 'live') || offer.partial === true) return null;
  if (!Array.isArray(offer.passengers) || offer.passengers.length !== query.adults) return null;
  const id = boundedString(offer.id, 100);
  const amount = typeof offer.total_amount === 'string' && /^\d{1,9}(?:\.\d{1,4})?$/.test(offer.total_amount) && Number(offer.total_amount) > 0 ? offer.total_amount : null;
  const currency = code(offer.total_currency);
  const expiresAt = timestamp(offer.expires_at);
  const carrierName = boundedString(record(offer.owner)?.name);
  if (!id || !amount || !currency || !expiresAt || Date.parse(expiresAt) <= now + 15000 || !carrierName || !Array.isArray(offer.slices) || offer.slices.length !== (query.returnDate ? 2 : 1)) return null;
  // Never send passenger records, client_key, service tokens, or the raw provider body to the browser.
  const slices: TravelOffer['slices'] = [];
  const operatingCarriers = new Set<string>();
  for (const rawSlice of offer.slices) {
    const slice = record(rawSlice);
    if (!slice || !Array.isArray(slice.segments) || !slice.segments.length || slice.segments.length > query.maxConnections + 1) return null;
    const segments: TravelSegment[] = [];
    for (const rawSegment of slice.segments) {
      const segment = record(rawSegment);
      if (!segment) return null;
      const origin = placeCode(segment.origin), destination = placeCode(segment.destination);
      const departureAt = flightTime(segment.departing_at), arrivalAt = flightTime(segment.arriving_at);
      const carrier = record(segment.operating_carrier);
      const operatingCarrier = boundedString(carrier?.name);
      if (!origin || !destination || !departureAt || !arrivalAt || !operatingCarrier) return null;
      const flightCode = boundedString(carrier?.iata_code, 3);
      const flightNo = boundedString(segment.operating_carrier_flight_number, 12);
      operatingCarriers.add(operatingCarrier);
      segments.push({ origin, destination, departureAt, arrivalAt, operatingCarrier, flightNumber: [flightCode, flightNo].filter(Boolean).join(' '), duration: duration(segment.duration) });
    }
    const origin = placeCode(slice.origin) || segments[0].origin;
    const destination = placeCode(slice.destination) || segments[segments.length - 1].destination;
    const index = slices.length;
    // Metro searches such as LON legitimately resolve to airport IATAs such as LHR.
    const expectedOrigin = index === 0 ? query.origin : query.destination;
    const expectedDestination = index === 0 ? query.destination : query.origin;
    if ((!matchesPlace(slice.origin, expectedOrigin) && !matchesPlace(record(slice.segments[0])?.origin, expectedOrigin)) || (!matchesPlace(slice.destination, expectedDestination) && !matchesPlace(record(slice.segments[slice.segments.length - 1])?.destination, expectedDestination)) || segments[0].departureAt.slice(0, 10) !== (index === 0 ? query.departureDate : query.returnDate)) return null;
    for (let i = 1; i < segments.length; i++) if (segments[i - 1].destination !== segments[i].origin) return null;
    slices.push({ origin, destination, duration: duration(slice.duration), segments });
  }
  return { id, provider: 'Duffel', mode, dataKind: mode === 'live' ? 'live' : 'simulated', price: { amount, currency, totalPassengers: query.adults }, consultedAt, expiresAt, carrierName, operatingCarriers: [...operatingCarriers], slices, availability: 'subject_to_confirmation', bookingAvailable: false };
}

async function readLimited(body: ReadableStream<Uint8Array> | null, maximum: number, tooLarge: () => Error): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw tooLarge(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function response(data: unknown, status = 200, retryAfter?: number): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) } });
}

export function createTravelService({ env, fetcher = fetch, clock = () => Date.now(), timeoutMs = 12000 }: {
  env: Environment;
  fetcher?: typeof fetch;
  clock?: () => number;
  timeoutMs?: number;
}) {
  const token = env.DUFFEL_ACCESS_TOKEN?.trim() || '';
  const configuredMode = env.DUFFEL_MODE;
  const mode: TravelMode = configuredMode === 'live' ? 'live' : 'test';
  const correctTokenMode = mode === 'test' ? token.startsWith('duffel_test_') : !token.startsWith('duffel_test_');
  const available = env.TRAVEL_SEARCH_ENABLED === 'true' && token.length >= 20 && !/[\s\x00-\x1f\x7f]/.test(token) && (configuredMode === 'live' || configuredMode === 'test') && correctTokenMode;
  const requestedDailyLimit = Number(env.TRAVEL_SEARCH_DAILY_LIMIT || 100);
  const dailyLimit = Number.isInteger(requestedDailyLimit) && requestedDailyLimit >= 1 && requestedDailyLimit <= 2000 ? requestedDailyLimit : 100;
  const cache = new Map<string, { result: TravelSearchResult; until: number }>();
  const pending = new Map<string, Promise<TravelSearchResult>>();
  let minuteWindow = -1, minuteCount = 0, dayWindow = -1, dayCount = 0;

  function status(): TravelStatus {
    return { provider: 'Duffel', available, mode: available ? mode : 'unavailable', message: available ? mode === 'live' ? 'Consulta tarifas del proveedor para tu ruta y fechas. El precio se confirma antes de reservar.' : 'Modo de prueba: horarios y precios simulados, no disponibles para reservar.' : 'Estamos preparando las tarifas de vuelos. Todavía no hay precios ni disponibilidad verificados.', cacheSeconds: CACHE_SECONDS, bookingAvailable: false, coverage: COVERAGE };
  }

  function guardOrigin(request: Request) {
    const expected = env.APP_ORIGIN || (env.NODE_ENV !== 'production' ? new URL(request.url).origin : '');
    let valid = false;
    try { const parsed = new URL(expected); valid = parsed.origin === expected && ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && (env.NODE_ENV !== 'production' || parsed.protocol === 'https:'); } catch { /* Fail closed. */ }
    if (!valid) throw new TravelError(503, 'ORIGIN_NOT_CONFIGURED', 'La búsqueda no está disponible por el momento.');
    if (request.headers.get('origin') !== expected || request.headers.get('sec-fetch-site') === 'cross-site')
      throw new TravelError(403, 'INVALID_ORIGIN', 'Origen de la solicitud no permitido.');
  }

  function consumeBudget() {
    const now = clock(), minute = Math.floor(now / 60000), day = Math.floor(now / 86400000);
    if (minute !== minuteWindow) { minuteWindow = minute; minuteCount = 0; }
    if (day !== dayWindow) { dayWindow = day; dayCount = 0; }
    if (dayCount >= dailyLimit) throw new TravelError(429, 'DAILY_LIMIT', 'Se alcanzó el límite de consultas de hoy. Intenta de nuevo mañana.', Math.ceil(((day + 1) * 86400000 - now) / 1000));
    if (minuteCount >= 20 || pending.size >= 3) throw new TravelError(429, 'RATE_LIMITED', 'Hay muchas consultas en este momento. Espera un minuto e intenta otra vez.', 60);
    minuteCount++; dayCount++;
  }

  async function providerSearch(query: TravelSearchInput): Promise<TravelSearchResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const slices = [{ origin: query.origin, destination: query.destination, departure_date: query.departureDate }];
      if (query.returnDate) slices.push({ origin: query.destination, destination: query.origin, departure_date: query.returnDate });
      const remote = await fetcher(PROVIDER_URL, { method: 'POST', redirect: 'error', signal: controller.signal, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Duffel-Version': 'v2', Authorization: `Bearer ${token}` }, body: JSON.stringify({ data: { slices, passengers: Array.from({ length: query.adults }, () => ({ type: 'adult' })), cabin_class: query.cabinClass, max_connections: query.maxConnections } }) });
      if (!remote.ok) {
        await remote.body?.cancel();
        if (remote.status === 401 || remote.status === 403) throw new TravelError(503, 'PROVIDER_NOT_READY', 'La conexión de tarifas todavía no está disponible.');
        if (remote.status === 400 || remote.status === 422) throw new TravelError(400, 'PROVIDER_SEARCH_REJECTED', 'El proveedor no pudo consultar esta ruta. Revisa los aeropuertos, las fechas y los pasajeros.');
        if (remote.status === 429) throw new TravelError(503, 'PROVIDER_BUSY', 'El proveedor está recibiendo muchas consultas. Intenta de nuevo en unos minutos.', 60);
        throw new TravelError(502, 'PROVIDER_UNAVAILABLE', 'No pudimos consultar las tarifas. Intenta de nuevo en unos minutos.');
      }
      const invalidResponse = () => new TravelError(502, 'INVALID_PROVIDER_RESPONSE', 'El proveedor no devolvió tarifas que podamos verificar.');
      if (Number(remote.headers.get('content-length') || 0) > MAX_PROVIDER_BYTES) { await remote.body?.cancel(); throw invalidResponse(); }
      const raw = await readLimited(remote.body, MAX_PROVIDER_BYTES, invalidResponse);
      let payload: unknown;
      try { payload = JSON.parse(raw); } catch { throw invalidResponse(); }
      const data = record(record(payload)?.data);
      if (!data || !Array.isArray(data.offers) || data.live_mode !== (mode === 'live') || data.offers.length > 3000) throw invalidResponse();
      const now = clock(), consultedAt = new Date(now).toISOString();
      const seen = new Set<string>();
      const offers = data.offers.map(value => normalizeOffer(value, query, mode, consultedAt, now)).filter((offer): offer is TravelOffer => !!offer && !seen.has(offer.id) && !!seen.add(offer.id)).sort((a, b) => a.price.currency.localeCompare(b.price.currency) || Number(a.price.amount) - Number(b.price.amount)).slice(0, 30);
      return { provider: 'Duffel', mode, dataKind: mode === 'live' ? 'live' : 'simulated', consultedAt, expiresAt: offers.length ? new Date(Math.min(...offers.map(offer => Date.parse(offer.expiresAt)))).toISOString() : null, cached: false, query, offers, message: mode === 'test' ? 'Resultados simulados de prueba. No son tarifas reales ni se pueden reservar.' : offers.length ? 'Tarifas consultadas para todos los adultos indicados, sujetas a disponibilidad y confirmación. Los extras y cargos por pago pueden variar.' : 'No recibimos ofertas vigentes para esta búsqueda. Prueba otras fechas o aeropuertos.' };
    } catch (error) {
      if (controller.signal.aborted) throw new TravelError(504, 'PROVIDER_TIMEOUT', 'La consulta tardó demasiado. Vuelve a intentarlo.');
      if (error instanceof TravelError) throw error;
      throw new TravelError(502, 'PROVIDER_UNAVAILABLE', 'No pudimos consultar las tarifas. Intenta de nuevo en unos minutos.');
    } finally { clearTimeout(timer); }
  }

  async function search(query: TravelSearchInput): Promise<TravelSearchResult> {
    const key = JSON.stringify(query), now = clock();
    for (const [oldKey, entry] of cache) if (entry.until <= now) cache.delete(oldKey);
    const found = cache.get(key);
    if (found) return { ...found.result, cached: true };
    const running = pending.get(key);
    if (running) return { ...await running, cached: true };
    consumeBudget();
    const task = providerSearch(query);
    pending.set(key, task);
    try {
      const result = await task;
      const until = Math.min(clock() + CACHE_SECONDS * 1000, result.expiresAt ? Date.parse(result.expiresAt) - 15000 : Infinity);
      if (until > clock()) {
        if (cache.size >= 200) cache.delete(cache.keys().next().value!);
        cache.set(key, { result, until });
      }
      return result;
    } finally { pending.delete(key); }
  }

  async function handleSearch(request: Request): Promise<Response> {
    try {
      if (request.method !== 'POST') throw new TravelError(405, 'METHOD_NOT_ALLOWED', 'Usa POST para consultar tarifas.');
      guardOrigin(request);
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new TravelError(415, 'JSON_REQUIRED', 'Se requiere JSON.');
      if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) throw new TravelError(413, 'BODY_TOO_LARGE', 'La búsqueda es demasiado grande.');
      const raw = await readLimited(request.body, MAX_BODY_BYTES, () => new TravelError(413, 'BODY_TOO_LARGE', 'La búsqueda es demasiado grande.'));
      let body: unknown;
      try { body = JSON.parse(raw); } catch { throw new TravelError(400, 'INVALID_JSON', 'La búsqueda no contiene JSON válido.'); }
      const query = validateTravelSearch(body, clock());
      if (!available) throw new TravelError(503, 'NOT_CONFIGURED', status().message);
      return response(await search(query));
    } catch (error) {
      const safe = error instanceof TravelError ? error : new TravelError(400, 'INVALID_REQUEST', 'No pudimos leer esta búsqueda.');
      return response({ code: safe.code, error: safe.message, message: safe.message, offers: [], provider: 'Duffel', mode: available ? mode : 'unavailable' }, safe.status, safe.retryAfter);
    }
  }
  return { status, handleStatus: () => response(status()), handleSearch };
}

let service: ReturnType<typeof createTravelService> | undefined;
export function getTravelService() {
  return service ??= createTravelService({ env: process.env });
}
