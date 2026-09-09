// Manual, reproducible snapshot of the public-domain OurAirports catalogue.
// Run: node scripts/update-destinations.mjs. Review the diff, test and deploy.
// This script does not fetch prices, run on application requests or install a scheduler.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const base = 'https://davidmegginson.github.io/ourairports-data/';
const maxBytes = 25 * 1024 * 1024;

// RFC 4180 fields: commas, quoted newlines and doubled quotes are all supported.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift()?.map((value, index) => index ? value : value.replace(/^\uFEFF/, ''));
  if (!headers?.length || new Set(headers).size !== headers.length) throw new Error('CSV headers are missing or duplicated');
  return rows.map((values) => {
    if (values.length !== headers.length) throw new Error('CSV row width differs from headers');
    return Object.fromEntries(headers.map((name, index) => [name, values[index]]));
  });
}

async function download(name) {
  const url = `${base}${name}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error(`${name}: source exceeds the size limit`);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error(`${name}: source exceeds the size limit`);
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  return { rows: parseCsv(buffer.toString('utf8')), url, sha256: createHash('sha256').update(buffer).digest('hex'), lastModified: response.headers.get('last-modified') };
}

export function buildCatalog(airportRows, countryRows) {
  const countries = new Map(countryRows.map((row) => [row.code, row]));
  const names = new Intl.DisplayNames(['es'], { type: 'region', fallback: 'none' });
  const regions = new Set(['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA']);
  const types = new Set(['large_airport', 'medium_airport', 'small_airport', 'seaplane_base']);
  const seenIata = new Set();
  const airports = airportRows.filter((row) => row.scheduled_service === 'yes' && types.has(row.type) && /^[A-Z]{3}$/.test(row.iata_code)).map((row) => {
    const country = countries.get(row.iso_country);
    const latitude = Number(row.latitude_deg), longitude = Number(row.longitude_deg);
    if (!country || !regions.has(row.continent) || !row.id || !row.name || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error(`Invalid airport record ${row.ident}`);
    }
    if (seenIata.has(row.iata_code)) throw new Error(`Duplicate active IATA code ${row.iata_code}; review the upstream source`);
    seenIata.add(row.iata_code);
    return {
      id: `ourairports-${row.id}`, iata: row.iata_code,
      name: row.municipality.trim() || row.name,
      airport: row.name, countryCode: row.iso_country, region: row.continent,
      latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)),
      ...(row.keywords.trim() ? { keywords: row.keywords.trim() } : {}),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'es') || a.iata.localeCompare(b.iata));
  const usedCountries = new Set(airports.map((airport) => airport.countryCode));
  return {
    countries: countryRows.filter((country) => usedCountries.has(country.code)).map((country) => ({
      code: country.code, name: names.of(country.code) || country.name, englishName: country.name,
      region: country.continent,
    })).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    airports,
  };
}

export async function updateCatalog() {
  const [airports, countries] = await Promise.all([download('airports.csv'), download('countries.csv')]);
  const catalog = buildCatalog(airports.rows, countries.rows);
  if (catalog.airports.length < 2000 || catalog.countries.length < 150 || catalog.airports.filter((airport) => airport.countryCode === 'BO').length < 5) {
    throw new Error('Unexpectedly small source snapshot; the previous catalogue was not changed');
  }
  const snapshot = {
    source: {
      name: 'OurAirports', url: 'https://ourairports.com/data/',
      dictionaryUrl: 'https://ourairports.com/help/data-dictionary.html',
      license: 'Public domain', downloadedAt: new Date().toISOString(),
      airportCount: catalog.airports.length, countryCount: catalog.countries.length,
      coverage: 'Aeropuertos con código IATA y servicio regular declarado en OurAirports. Incluye países y territorios. No garantiza cobertura completa ni vuelos, rutas o tarifas disponibles.',
      files: [airports, countries].map(({ url, sha256, lastModified }) => ({ url, sha256, lastModified })),
    },
    ...catalog,
  };
  const output = new URL('../lib/data/destinations.json', import.meta.url);
  await mkdir(new URL('../lib/data/', import.meta.url), { recursive: true });
  await writeFile(output, `${JSON.stringify(snapshot)}\n`, 'utf8');
  console.log(`Updated ${catalog.airports.length} airports in ${catalog.countries.length} countries and territories: ${fileURLToPath(output)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await updateCatalog();
}
