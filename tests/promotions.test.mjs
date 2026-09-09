import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPromotionService,
  parseAviancaPromotion,
  PROMOTION_SOURCES,
  PROMOTION_TTL_MS,
} from '../lib/travel/promotions.ts';

// Reduced public HTML observations retrieved with an unauthenticated standard
// fetch on 2026-09-09. These fixtures are tests, never runtime fallback offers.
const bogLaPaz = `
  <span class="banner-route-p" tabindex="0">Bogotá a La Paz</span>
  <div class="banner-subtitle-p" tabindex="0" role="text">Ida y vuelta desde</div>
  <span class="banner-price-p" tabindex="0">1.904.490 COP</span>
  <span class="banner-miles-p" tabindex="0">18.070 millas + impuestos y tasas</span>
  <span class="hh-city">Bogotá (BOG)</span><span class="hh-city">La Paz (LPB)</span>
  <span class="hh-tt-value">Solo ida</span>`;
const bogSantaCruz = `
  <span class="banner-route-p" tabindex="0">Bogotá a Santa Cruz, Bolivia</span>
  <div class="banner-subtitle-p" tabindex="0" role="text">Ida y vuelta desde</div>
  <span class="banner-price-p" tabindex="0">1.738.840 COP</span>
  <span class="hh-city">Bogotá (BOG)</span><span class="hh-city">Santa Cruz, Bolivia (SRZ)</span>`;
const checkedAt = Date.parse('2026-09-09T12:00:00.000Z');
const htmlResponse = (body = bogLaPaz) =>
  new Response(body, {
    headers: { 'content-type': 'text/html;charset=utf-8' },
  });

test('published cash banner keeps its own trip type and never borrows calendar/miles details', () => {
  const offer = parseAviancaPromotion(
    `<div class="banner-container"><div class="banner-inner">${bogLaPaz}</div></div>`,
    PROMOTION_SOURCES[0],
    checkedAt,
  );
  assert.equal(offer.price, '1904490.00');
  assert.equal(offer.currency, 'COP');
  assert.equal(offer.tripType, 'round-trip');
  assert.equal(offer.departureDate, null);
  assert.equal(offer.returnDate, null);
  assert.equal(offer.cabin, null);
  assert.equal(offer.taxesIncluded, null);
  assert.equal(offer.pointOfSale, 'Colombia');
  assert.equal(Date.parse(offer.expiresAt) - checkedAt, PROMOTION_TTL_MS);
  assert.match(offer.notice, /No es una cotización/);
});

test('city codes remain as published instead of being turned into another airport', () => {
  const offer = parseAviancaPromotion(
    bogSantaCruz,
    PROMOTION_SOURCES[1],
    checkedAt,
  );
  assert.equal(offer.destination.iata, 'SRZ');
  assert.equal(offer.destination.kind, 'city');
  assert.equal(offer.price, '1738840.00');
});

test('missing, mismatched or ambiguous data is rejected, including cash present only in scripts', () => {
  for (const body of [
    bogLaPaz.replace('banner-price-p', 'banner-miles-p'),
    bogLaPaz.replace('1.904.490 COP', '1.904.490 millas'),
    bogLaPaz.replace('1.904.490 COP', '1.90.4490 COP'),
    bogLaPaz.replace('Ida y vuelta desde', 'Por trayecto desde'),
    bogLaPaz.replace('La Paz (LPB)', 'La Paz (LAP)'),
    bogLaPaz.replace('Bogotá a La Paz', 'Bogotá a Madrid'),
    bogLaPaz + bogLaPaz,
    `<script>${bogLaPaz}</script>`,
    '<h1>Pardon Our Interruption</h1>',
  ]) {
    assert.equal(
      parseAviancaPromotion(body, PROMOTION_SOURCES[0], checkedAt),
      null,
    );
  }
});

test('concurrent clients share one refresh and upstream concurrency stays bounded', async () => {
  let requests = 0;
  let active = 0;
  let maxActive = 0;
  const service = createPromotionService({
    now: () => checkedAt,
    fetch: async (url) => {
      requests++;
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return url === PROMOTION_SOURCES[0].url
        ? htmlResponse()
        : new Response('', { status: 503 });
    },
  });
  const [first, concurrent] = await Promise.all([
    service.getFeed(),
    service.getFeed(),
  ]);
  assert.deepEqual(first, concurrent);
  assert.equal(requests, 4);
  assert.equal(maxActive, 2);
  assert.equal(first.offers.length, 1);
  assert.equal(
    first.sources.filter((source) => source.status === 'unavailable').length,
    3,
  );
  await service.getFeed();
  assert.equal(requests, 4);
});

test('expired cached observations disappear when the source fails; failures have a retry TTL', async () => {
  let current = checkedAt;
  let failing = false;
  let requests = 0;
  const service = createPromotionService({
    now: () => current,
    fetch: async (url) => {
      requests++;
      if (failing) throw new Error('Network unavailable');
      return url === PROMOTION_SOURCES[0].url
        ? htmlResponse()
        : new Response('', { status: 503 });
    },
  });
  const first = await service.getFeed();
  assert.equal(first.offers.length, 1);
  current += PROMOTION_TTL_MS + 1;
  failing = true;
  const afterExpiry = await service.getFeed();
  assert.deepEqual(afterExpiry.offers, []);
  assert.ok(
    afterExpiry.sources.every((source) => source.status === 'unavailable'),
  );
  assert.equal(requests, 8);
  await service.getFeed();
  assert.equal(requests, 8);
  current = Date.parse(afterExpiry.nextRefreshAt) + 1;
  await service.getFeed();
  assert.equal(requests, 12);
});

test('unexpected redirects, content types, and oversized bodies never become offers', async () => {
  const badResponseFactories = [
    () =>
      new Response(bogLaPaz, {
        headers: { 'content-type': 'application/json' },
      }),
    () => htmlResponse(' '.repeat(500_001)),
    () =>
      new Response(bogLaPaz, {
        headers: { 'content-type': 'text/html', 'content-length': '500001' },
      }),
    () => {
      const response = htmlResponse();
      Object.defineProperty(response, 'url', {
        value: 'https://www.avianca.com/es/ofertas/ofertas-vuelos',
      });
      return response;
    },
  ];
  for (const factory of badResponseFactories) {
    const service = createPromotionService({
      now: () => checkedAt,
      fetch: async () => factory(),
    });
    assert.deepEqual((await service.getFeed()).offers, []);
  }
});

test('only allowlisted sources are requested without credentials and redirects are refused', async () => {
  const requested = [];
  const service = createPromotionService({
    now: () => checkedAt,
    fetch: async (url, options) => {
      requested.push(url);
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      assert.deepEqual(options.headers, { Accept: 'text/html' });
      return new Response('', { status: 503 });
    },
  });
  await service.getFeed();
  assert.deepEqual(
    requested.sort(),
    PROMOTION_SOURCES.map((source) => source.url).sort(),
  );
});
