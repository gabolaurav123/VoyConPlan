import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTravelService, validateTravelSearch } from '../lib/travel/service.ts';

const now = Date.parse('2026-09-09T12:00:00Z');
const input = { origin: 'LPB', destination: 'MAD', departureDate: '2026-10-10', adults: 2 };
const token = 'duffel_live_fixture_not_a_real_token';
const env = { APP_ORIGIN: 'https://voyconplan.test', NODE_ENV: 'production', TRAVEL_SEARCH_ENABLED: 'true', DUFFEL_ACCESS_TOKEN: token, DUFFEL_MODE: 'live' };
const place = (iata, city) => ({ iata_code: iata, ...(city ? { iata_city_code: city, city: { iata_code: city } } : {}) });
function flightSlice(origin = 'LPB', destination = 'MAD', date = '2026-10-10') {
  return { origin: place(origin), destination: place(destination), duration: 'PT10H30M', segments: [{ origin: place(origin), destination: place(destination), departing_at: date + 'T08:15:00', arriving_at: date + 'T19:45:00', operating_carrier: { name: 'Operadora de prueba', iata_code: 'ZZ' }, operating_carrier_flight_number: '123', duration: 'PT10H30M' }] };
}
function offer(overrides = {}) {
  return { id: 'off_fixture_1', live_mode: true, total_amount: '654.32', total_currency: 'USD', expires_at: '2026-09-09T12:30:00Z', owner: { name: 'Aerolínea de prueba' }, slices: [flightSlice()], passengers: [{ type: 'adult', name: 'PRIVATE_PASSENGER_CANARY' }, { type: 'adult' }], client_key: 'PRIVATE_CLIENT_KEY_CANARY', ...overrides };
}
const providerResponse = (offers = [offer()], liveMode = true) => Response.json({ data: { offers, live_mode: liveMode, client_key: 'PRIVATE_REQUEST_KEY_CANARY' } });
function fixture(overrides = {}) {
  let time = now, calls = 0;
  const requests = [];
  const fetcher = overrides.fetcher || (async (url, options) => { requests.push({ url, options }); calls++; return providerResponse(); });
  const service = createTravelService({ env: { ...env, ...overrides.env }, clock: () => time, fetcher, timeoutMs: overrides.timeoutMs });
  const request = (body = input, headers = {}, method = 'POST') => service.handleSearch(new Request(env.APP_ORIGIN + '/api/travel/search', { method, headers: { Origin: env.APP_ORIGIN, 'Content-Type': 'application/json', ...headers }, ...(method !== 'GET' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) }));
  return { service, request, requests, calls: () => calls, advance: ms => { time += ms; } };
}

test('normaliza IATA y valida fechas, pasajeros, cabina y campos desconocidos', () => {
  assert.deepEqual(validateTravelSearch({ ...input, origin: ' lpb ', destination: 'mad' }, now), { ...input, cabinClass: 'economy', maxConnections: 1 });
  const invalid = [null, [], { ...input, origin: 'https://evil.test' }, { ...input, destination: 'LPB' }, { ...input, departureDate: '2026-02-30' }, { ...input, departureDate: '2026-09-08' }, { ...input, departureDate: '2028-01-01' }, { ...input, returnDate: '2026-10-09' }, { ...input, adults: 0 }, { ...input, adults: 10 }, { ...input, adults: '2' }, { ...input, maxConnections: 3 }, { ...input, cabinClass: 'invalid' }, { ...input, providerUrl: 'https://evil.test' }];
  for (const value of invalid) assert.throws(() => validateTravelSearch(value, now), error => error.status === 400);
  assert.equal(validateTravelSearch({ ...input, returnDate: '2026-10-10', adults: 9 }, now).adults, 9);
});

test('sin conexión configurada, estado explícito y 503 sin ofertas ni acceso al proveedor', async () => {
  for (const overrides of [{ DUFFEL_ACCESS_TOKEN: '' }, { TRAVEL_SEARCH_ENABLED: 'false' }, { DUFFEL_MODE: undefined }, { DUFFEL_ACCESS_TOKEN: 'duffel_test_fixture_token_not_real' }, { DUFFEL_MODE: 'test' }]) {
    const f = fixture({ env: overrides });
    const status = await f.service.handleStatus().json();
    assert.equal(status.available, false); assert.equal(status.mode, 'unavailable');
    const response = await f.request(); const result = await response.json();
    assert.equal(response.status, 503); assert.equal(result.code, 'NOT_CONFIGURED'); assert.deepEqual(result.offers, []); assert.equal(f.calls(), 0);
    assert.doesNotMatch(JSON.stringify(status), /ACCESS_TOKEN|duffel_(test|live)_/);
  }
});

test('el estado no consume consultas ni asegura disponibilidad de rutas', async () => {
  const f = fixture(); const response = f.service.handleStatus(); const result = await response.json();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(result.available, true); assert.equal(result.bookingAvailable, false); assert.equal(f.calls(), 0);
  assert.match(result.coverage, /Según rutas/);
});

test('origen, método y JSON se verifican antes de consultar', async () => {
  const f = fixture();
  for (const [body, headers, method, expected] of [[input, { Origin: 'https://evil.test' }, 'POST', 403], [input, { Origin: '' }, 'POST', 403], [input, { 'Sec-Fetch-Site': 'cross-site' }, 'POST', 403], [input, {}, 'GET', 405], [input, { 'Content-Type': 'text/plain' }, 'POST', 415], ['{invalid', {}, 'POST', 400], ['x'.repeat(5000), {}, 'POST', 413], [input, { 'Content-Length': '10000' }, 'POST', 413]]) {
    assert.equal((await f.request(body, headers, method)).status, expected);
  }
  assert.equal(f.calls(), 0);
  assert.equal((await fixture({ env: { APP_ORIGIN: '' } }).request()).status, 503);
  assert.equal((await fixture({ env: { APP_ORIGIN: 'https://voyconplan.test/' } }).request()).status, 503);
});

test('envía Duffel v2 al host fijo y devuelve sólo los datos públicos de la tarifa', async () => {
  const f = fixture(); const response = await f.request(); const result = await response.json();
  assert.equal(response.status, 200); assert.equal(result.mode, 'live'); assert.equal(result.cached, false);
  assert.equal(result.offers[0].price.amount, '654.32'); assert.equal(result.offers[0].price.currency, 'USD'); assert.equal(result.offers[0].price.totalPassengers, 2);
  assert.deepEqual(result.offers[0].operatingCarriers, ['Operadora de prueba']);
  assert.equal(result.offers[0].slices[0].segments[0].departureAt, '2026-10-10T08:15:00');
  assert.equal(result.offers[0].consultedAt, '2026-09-09T12:00:00.000Z'); assert.equal(result.offers[0].expiresAt, '2026-09-09T12:30:00.000Z');
  assert.equal(result.offers[0].availability, 'subject_to_confirmation'); assert.equal(result.offers[0].bookingAvailable, false);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|duffel_live_fixture|Authorization|client_key/);
  const { url, options } = f.requests[0];
  assert.equal(new URL(url).origin, 'https://api.duffel.com'); assert.equal(options.redirect, 'error');
  assert.equal(options.headers.Authorization, 'Bearer ' + token); assert.equal(options.headers['Duffel-Version'], 'v2');
  const data = JSON.parse(options.body).data;
  assert.deepEqual(data.passengers, [{ type: 'adult' }, { type: 'adult' }]); assert.equal(data.slices.length, 1); assert.equal(data.cabin_class, 'economy');
});

test('ida y vuelta se envían como dos slices y el precio sigue siendo total', async () => {
  let sent;
  const f = fixture({ fetcher: async (_url, options) => { sent = JSON.parse(options.body); return providerResponse([offer({ slices: [flightSlice(), flightSlice('MAD', 'LPB', '2026-10-20')] })]); } });
  const result = await (await f.request({ ...input, returnDate: '2026-10-20', cabinClass: 'business', maxConnections: 0 })).json();
  assert.deepEqual(sent.data.slices[1], { origin: 'MAD', destination: 'LPB', departure_date: '2026-10-20' });
  assert.equal(result.offers[0].slices.length, 2); assert.equal(result.offers[0].price.amount, '654.32'); assert.equal(sent.data.cabin_class, 'business');
});

test('acepta el aeropuerto que corresponde al IATA metropolitano consultado', async () => {
  const slice = flightSlice('LHR', 'JFK'); slice.origin = place('LHR', 'LON'); slice.destination = place('JFK', 'NYC');
  const f = fixture({ fetcher: async () => providerResponse([offer({ slices: [slice] })]) });
  const result = await (await f.request({ ...input, origin: 'LON', destination: 'NYC' })).json();
  assert.equal(result.offers.length, 1); assert.equal(result.offers[0].slices[0].origin, 'LHR');
});

test('resultados test permanecen etiquetados como simulados y no como ofertas reales', async () => {
  const f = fixture({ env: { DUFFEL_MODE: 'test', DUFFEL_ACCESS_TOKEN: 'duffel_test_fixture_token_not_real' }, fetcher: async () => providerResponse([offer({ live_mode: false })], false) });
  const result = await (await f.request()).json();
  assert.equal(result.mode, 'test'); assert.equal(result.dataKind, 'simulated'); assert.equal(result.offers[0].dataKind, 'simulated'); assert.match(result.message, /simulados/);
});

test('rechaza respuestas de otro modo para impedir presentar datos simulados como reales', async () => {
  const f = fixture({ fetcher: async () => providerResponse([offer({ live_mode: false })], false) });
  const response = await f.request(); assert.equal(response.status, 502); assert.deepEqual((await response.json()).offers, []);
});

test('descarta ofertas vencidas, parciales, sin operadora, de otra ruta o con precios inválidos', async () => {
  const malformedSlice = flightSlice(); delete malformedSlice.segments[0].operating_carrier;
  const bad = [offer({ id: 'expired', expires_at: '2026-09-09T11:59:00Z' }), offer({ id: 'soon', expires_at: '2026-09-09T12:00:10Z' }), offer({ id: 'negative', total_amount: '-1' }), offer({ id: 'bad-currency', total_currency: 'NOT_CURRENCY' }), offer({ id: 'partial', partial: true }), offer({ id: 'bad-mode', live_mode: false }), offer({ id: 'missing-carrier', slices: [malformedSlice] }), offer({ id: 'wrong-route', slices: [flightSlice('LIM', 'MAD')] }), offer({ id: 'wrong-date', slices: [flightSlice('LPB', 'MAD', '2026-10-11')] })];
  const f = fixture({ fetcher: async () => providerResponse([...bad, offer(), offer()]) });
  const result = await (await f.request()).json(); assert.equal(result.offers.length, 1); assert.equal(result.offers[0].id, 'off_fixture_1');
});

test('caché de 90 s conserva fecha original y reconsulta tras caducar', async () => {
  const f = fixture(); const first = await (await f.request()).json();
  f.advance(30000); const second = await (await f.request()).json();
  assert.equal(second.cached, true); assert.equal(second.consultedAt, first.consultedAt); assert.equal(f.calls(), 1);
  f.advance(60000); const third = await (await f.request()).json();
  assert.equal(third.cached, false); assert.notEqual(third.consultedAt, first.consultedAt); assert.equal(f.calls(), 2);
});

test('no atribuye a dos adultos el importe de una oferta para un solo pasajero', async () => {
  const f = fixture({ fetcher: async () => providerResponse([offer({ passengers: [{ type: 'adult' }] })]) });
  const result = await (await f.request()).json();
  assert.deepEqual(result.offers, []);
});

test('caché nunca sobrevive al margen de expiración de una tarifa', async () => {
  let calls = 0;
  const f = fixture({ fetcher: async () => { calls++; return providerResponse([offer({ expires_at: '2026-09-09T12:01:00Z' })]); } });
  await f.request(); f.advance(45000);
  const result = await (await f.request()).json(); assert.equal(calls, 2); assert.equal(result.cached, false); assert.equal(result.offers.length, 0);
});

test('solicitudes idénticas concurrentes comparten una sola consulta', async () => {
  let finish, calls = 0;
  const gate = new Promise(resolve => { finish = resolve; });
  const f = fixture({ fetcher: async () => { calls++; await gate; return providerResponse(); } });
  const one = f.request(), two = f.request(); await new Promise(resolve => setImmediate(resolve)); finish();
  const results = await Promise.all([one, two]); assert.equal(calls, 1); assert.deepEqual(results.map(response => response.status), [200, 200]);
});

test('presupuesto diario limita nuevas llamadas pero mantiene las lecturas en caché', async () => {
  const f = fixture({ env: { TRAVEL_SEARCH_DAILY_LIMIT: '1' } });
  assert.equal((await f.request()).status, 200); assert.equal((await f.request()).status, 200);
  const response = await f.request({ ...input, adults: 3 }); assert.equal(response.status, 429); assert.equal((await response.json()).code, 'DAILY_LIMIT'); assert.ok(Number(response.headers.get('retry-after')) > 0); assert.equal(f.calls(), 1);
});

test('límite global por minuto no se elude cambiando cabeceras IP', async () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) assert.equal((await f.request({ ...input, departureDate: `2026-10-${String(i + 1).padStart(2, '0')}` }, { 'X-Forwarded-For': `10.0.0.${i}` })).status, 200);
  const response = await f.request({ ...input, departureDate: '2026-10-25' }, { 'X-Forwarded-For': '1.2.3.4' });
  assert.equal(response.status, 429); assert.equal(f.calls(), 20);
});

test('no se filtran cuerpos ni errores internos del proveedor', async () => {
  for (const [remoteStatus, expected] of [[401, 503], [403, 503], [422, 400], [429, 503], [500, 502]]) {
    const f = fixture({ fetcher: async () => new Response('SECRET_PROVIDER_DIAGNOSTICS ' + token, { status: remoteStatus }) });
    const response = await f.request(); const result = await response.json();
    assert.equal(response.status, expected); assert.deepEqual(result.offers, []); assert.doesNotMatch(JSON.stringify(result), /SECRET_|duffel_live_fixture/);
  }
  const f = fixture({ fetcher: async () => { throw new Error('SECRET_NETWORK_ERROR ' + token); } });
  assert.doesNotMatch(await (await f.request()).text(), /SECRET_|duffel_live_fixture/);
});

test('timeout cancela la consulta y permite reintentar sin cachear errores', async () => {
  let calls = 0;
  const f = fixture({ timeoutMs: 15, fetcher: async (_url, options) => { calls++; return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('abort')))); } });
  assert.equal((await f.request()).status, 504); assert.equal((await f.request()).status, 504); assert.equal(calls, 2);
});

test('valida JSON del proveedor y acota el tamaño de su respuesta', async () => {
  for (const fetcher of [async () => new Response('not-json'), async () => Response.json({ data: { offers: null, live_mode: true } }), async () => new Response('{}', { headers: { 'Content-Length': String(9 * 1024 * 1024) } })]) {
    assert.equal((await fixture({ fetcher }).request()).status, 502);
  }
});

test('no inventa descuentos ni convierte monedas al ordenar y limita a 30 ofertas', async () => {
  const offers = Array.from({ length: 35 }, (_, i) => offer({ id: 'off_' + i, total_amount: String(100 - i), total_currency: i === 0 ? 'EUR' : 'USD' }));
  const f = fixture({ fetcher: async () => providerResponse(offers) });
  const result = await (await f.request()).json();
  assert.equal(result.offers.length, 30); assert.equal(result.offers[0].price.currency, 'EUR'); assert.equal(result.offers[1].price.amount, '66');
  assert.ok(result.offers.every(item => !('discount' in item) && !('previousPrice' in item) && !('bookingUrl' in item)));
});
