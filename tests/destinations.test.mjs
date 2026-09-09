import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  searchDestinations, findDestinationByIata, destinationSource,
  destinationFacets, DestinationQueryError,
} from '../lib/destinations.ts';
import { GET } from '../app/api/destinations/route.ts';
import { parseCsv, buildCatalog } from '../scripts/update-destinations.mjs';

const search = (values = {}) => searchDestinations(new URLSearchParams(values));

test('snapshot records source, bounds, coverage and Bolivia without invented costs', async () => {
  const data = JSON.parse(await readFile(new URL('../lib/data/destinations.json', import.meta.url), 'utf8'));
  assert.ok(data.airports.length > 2000);
  assert.ok(data.countries.length > 150);
  assert.equal(data.airports.length, destinationSource.airportCount);
  assert.equal(data.countries.length, destinationSource.countryCount);
  assert.equal(destinationSource.license, 'Public domain');
  assert.equal(destinationSource.url, 'https://ourairports.com/data/');
  assert.ok(Number.isFinite(Date.parse(destinationSource.downloadedAt)));
  assert.ok(destinationSource.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
  assert.match(destinationSource.coverage, /No garantiza cobertura completa/);
  assert.equal(new Set(data.airports.map((airport) => airport.iata)).size, data.airports.length);
  for (const airport of data.airports) {
    assert.match(airport.iata, /^[A-Z]{3}$/);
    assert.ok(airport.latitude >= -90 && airport.latitude <= 90);
    assert.ok(airport.longitude >= -180 && airport.longitude <= 180);
    assert.ok(!Object.hasOwn(airport, 'price'));
    assert.ok(!Object.hasOwn(airport, 'fare'));
  }
  const bolivia = search({ country: 'BO', limit: 60 });
  assert.ok(bolivia.pagination.total >= 5);
  assert.ok(bolivia.destinations.some((airport) => airport.iata === 'LPB'));
  assert.ok(bolivia.destinations.some((airport) => airport.iata === 'VVI'));
  assert.ok(bolivia.destinations.every((airport) => airport.country === 'Bolivia' && airport.region === 'SA'));
});

test('municipality, Spanish country, IATA and accent-insensitive searches find destinations', () => {
  assert.equal(search({ q: 'lPb' }).destinations[0].iata, 'LPB');
  assert.equal(search({ q: 'La Paz', country: 'bo' }).destinations[0].iata, 'LPB');
  assert.equal(search({ q: 'Madrid' }).destinations[0].iata, 'MAD');
  assert.deepEqual(search({ q: 'São Paulo' }).destinations, search({ q: 'sao paulo' }).destinations);
  assert.ok(search({ q: 'sao paulo' }).destinations.some((airport) => airport.iata === 'GRU'));
  assert.ok(search({ q: 'España' }).destinations.every((airport) => airport.countryCode === 'ES'));
  assert.equal(findDestinationByIata(' mad ').name, 'Madrid');
  assert.equal(findDestinationByIata('constructor'), null);
  assert.equal(findDestinationByIata(''), null);
});

test('region and country filters compose and facets account for the full snapshot', () => {
  const response = search({ region: 'sa', country: 'BO', limit: 60 });
  assert.ok(response.destinations.length > 0);
  assert.ok(response.destinations.every((destination) => destination.region === 'SA' && destination.countryCode === 'BO'));
  assert.equal(search({ region: 'EU', country: 'BO' }).pagination.total, 0);
  assert.equal(destinationFacets.countries.reduce((sum, country) => sum + country.count, 0), destinationSource.airportCount);
  assert.equal(destinationFacets.regions.reduce((sum, region) => sum + region.count, 0), destinationSource.airportCount);
  assert.equal(destinationFacets.countries.find((country) => country.code === 'BO').count, response.pagination.total);
  assert.ok(destinationFacets.countries.find((country) => country.code === 'RU').regions.includes('AS'));
  assert.ok(destinationFacets.countries.find((country) => country.code === 'RU').regions.includes('EU'));
});

test('pagination is stable, bounded and exhausts without duplicates', () => {
  const first = search({ country: 'US', page: 1, limit: 60 });
  const second = search({ country: 'US', page: 2, limit: 60 });
  assert.equal(first.destinations.length, 60);
  assert.equal(first.pagination.hasNext, true);
  assert.equal(new Set([...first.destinations, ...second.destinations].map((airport) => airport.id)).size, 120);
  assert.deepEqual(first.destinations, search({ country: 'US', page: 1, limit: 60 }).destinations);
  assert.equal(search().destinations.length, 24);
  const end = search({ country: 'BO', page: 10000, limit: 60 });
  assert.equal(end.destinations.length, 0);
  assert.equal(end.pagination.hasNext, false);
  assert.deepEqual(search({ q: 'zzzzzzzzzznoairport' }).pagination, { page: 1, limit: 24, total: 0, totalPages: 0, hasNext: false });
});

test('oversized and malformed inputs are rejected rather than used as expensive queries', () => {
  for (const params of [
    { q: 'a'.repeat(101) }, { q: ' '.repeat(101) }, { q: 'a '.repeat(13) },
    { limit: '61' }, { limit: '0' }, { limit: '-1' }, { limit: '1.5' },
    { page: '10001' }, { page: 'Infinity' }, { page: '1e3' }, { page: '01' },
    { country: '__proto__' }, { country: 'XX' }, { region: 'constructor' }, { region: 'XX' },
  ]) assert.throws(() => search(params), DestinationQueryError);
});

test('queries and callers cannot mutate the shared result index', () => {
  const initial = search({ q: 'MAD' }).destinations[0];
  assert.throws(() => { initial.iata = 'BAD'; }, TypeError);
  const response = search({ country: 'BO' });
  response.destinations.length = 0;
  assert.ok(search({ country: 'BO' }).destinations.length > 0);
  assert.equal(findDestinationByIata('MAD').iata, 'MAD');
});

test('HTTP endpoint works without database access and marks invalid responses non-cacheable', async () => {
  const good = await GET(new Request('https://voyconplan.example/api/destinations?q=VVI'));
  assert.equal(good.status, 200);
  assert.match(good.headers.get('cache-control'), /public/);
  assert.equal((await good.json()).destinations[0].iata, 'VVI');
  const bad = await GET(new Request('https://voyconplan.example/api/destinations?limit=500'));
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get('cache-control'), 'no-store');
  assert.match((await bad.json()).error, /60/);
});

test('CSV importer preserves quoted commas, accents, newlines and escaped quotes', () => {
  assert.deepEqual(parseCsv('\uFEFFid,name,note\r\n1,"São Paulo, Brasil","A ""quoted""\nline"\r\n'), [
    { id: '1', name: 'São Paulo, Brasil', note: 'A "quoted"\nline' },
  ]);
  assert.throws(() => parseCsv('id,name\n1,"unterminated'), /unterminated/);
  assert.throws(() => parseCsv('id,name\n1,too,many'), /width/);
});

test('importer excludes closed and non-scheduled facilities and rejects corrupt IATA or coordinates', () => {
  const countries = [{ code: 'BO', name: 'Bolivia', continent: 'SA' }];
  const airport = {
    id: '1', ident: 'SLLP', type: 'large_airport', name: 'El Alto International Airport',
    municipality: 'La Paz', scheduled_service: 'yes', iata_code: 'LPB', iso_country: 'BO',
    continent: 'SA', latitude_deg: '-16.5', longitude_deg: '-68.1', keywords: '',
  };
  const imported = buildCatalog([airport, { ...airport, scheduled_service: 'no' }, { ...airport, type: 'closed_airport' }], countries);
  assert.equal(imported.airports.length, 1);
  assert.equal(imported.airports[0].iata, 'LPB');
  assert.throws(() => buildCatalog([airport, airport], countries), /Duplicate/);
  assert.throws(() => buildCatalog([{ ...airport, latitude_deg: 'invalid' }], countries), /Invalid/);
  assert.throws(() => buildCatalog([{ ...airport, longitude_deg: '200' }], countries), /Invalid/);
});
