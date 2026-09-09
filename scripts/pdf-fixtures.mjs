import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { buildTripPDF, PDF_PAGE_BOUNDS } from '../lib/pdf/trip-pdf.ts';
import { createPdfExample } from '../lib/pdf-example.ts';
import { createTrip, demoDestinations } from '../lib/domain.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, process.env.PDF_QA_DIR || 'work/qa');
await mkdir(out, { recursive: true });
const optional = async (file) => { try { return new Uint8Array(await readFile(resolve(root, file))); } catch { return undefined; } };
const [logo, editorial, photo, regular, semibold] = await Promise.all([
  optional('public/brand/logo.png'), optional('public/brand/travel-editorial.png'), optional('public/images/cartagena.jpg'),
  optional('public/fonts/pdf/Inter-Regular.ttf'), optional('public/fonts/pdf/Inter-Semibold.ttf'),
]);
const options = {
  generatedAt: '2026-09-09T12:00:00Z',
  assets: {
    ...(logo ? { logo: { data: logo, format: 'PNG' } } : {}),
    ...(editorial ? { editorial: { data: editorial, format: 'PNG', credit: 'Imagen editorial generada para VoyConPlan.' } } : {}),
    ...(photo ? { destination: { data: photo, format: 'JPEG', credit: 'Fotografía: Ricky Beron / Unsplash' } } : {}),
  },
  ...(regular && semibold ? { fonts: { regular: Buffer.from(regular).toString('base64'), semibold: Buffer.from(semibold).toString('base64') } } : {}),
};
const report = [];
for (const [name, days] of [['corto', 3], ['largo', 14]]) {
  const example = createPdfExample(days);
  // Exercise variable-height cards in a complete trip without exposing personal data.
  if (days === 14) {
    example.trip.itinerary[5].items[0].notes += ' Recuerda revisar los horarios por temporada, la distancia desde tu alojamiento y las opciones de transporte disponibles. Si cambian tus planes, mueve este bloque a otro momento y conserva espacio para descansar. '.repeat(3);
  }
  const inputBefore = JSON.stringify(example);
  const result = buildTripPDF(example.trip, example.destination, options);
  assert.equal(JSON.stringify(example), inputBefore, 'Builder must not mutate its input');
  assert.ok(result.layout.every((block) => block.y >= PDF_PAGE_BOUNDS.top - 0.01 && block.y + block.height <= PDF_PAGE_BOUNDS.bottom + 0.01), 'Every content block must remain inside its page');
  if (days === 3) assert.equal(result.pageCount, 2, 'The complete three-day sample fits two pages');
  for (let page = 1; page <= result.pageCount; page++) assert.ok(result.layout.some((block) => block.page === page), 'No empty content pages');
  await writeFile(resolve(out, `voyconplan-${name}.pdf`), Buffer.from(result.doc.output('arraybuffer')));
  await writeFile(resolve(out, `voyconplan-${name}.layout.json`), JSON.stringify(result.layout, null, 2));
  report.push({ name, days, pages: result.pageCount, assets: { logo: !!logo, photo: !!photo, inter: !!regular && !!semibold }, warnings: result.warnings });
}

// Edge cases: missing fields, long text, QR, and many empty days.
const example = createPdfExample(3);
const empty = buildTripPDF({ title: 'Viaje por definir' }, null, options);
assert.ok(empty.pageCount <= 2, 'Missing data should remain compact');
const noActivities = structuredClone(example.trip);
noActivities.itinerary = Array.from({ length: 14 }, (_, index) => ({ date: `2026-11-${String(index + 1).padStart(2, '0')}`, items: [] }));
const emptyDays = buildTripPDF(noActivities, example.destination, options);
assert.equal(emptyDays.layout.filter((block) => block.kind === 'empty-days').length, 1, 'Consecutive empty days collapse to one block');
assert.ok(emptyDays.pageCount <= 2, 'Empty days must not produce individual pages');
const long = structuredClone(example.trip);
long.itinerary[0].items[0].notes = 'Texto largo con acentos: orientación, conexión, equipaje y documentación. '.repeat(110);
const lengthy = buildTripPDF(long, example.destination, { ...options, shareUrl: 'https://example.test/plan', assets: { ...options.assets, qr: { data: await QRCode.toDataURL('https://example.test/plan'), format: 'PNG' } } });
assert.ok(lengthy.layout.every((block) => block.y + block.height <= PDF_PAGE_BOUNDS.bottom + 0.01), 'Long cards must continue safely');
const itineraryHeading = lengthy.layout.findIndex((block) => block.kind === 'heading:Tu itinerario');
assert.equal(lengthy.layout[itineraryHeading].page, lengthy.layout[itineraryHeading + 1].page, 'The itinerary heading stays with its first day, including long notes');
await writeFile(resolve(out, 'voyconplan-texto-largo.pdf'), Buffer.from(lengthy.doc.output('arraybuffer')));
const nativeDestination = demoDestinations[0];
const nativeTrip = createTrip(nativeDestination, { origin: 'La Paz', budget: 1500, currency: 'USD', travelers: 2, days: 3, date: '2026-11-09', type: 'En pareja', interests: [], includeFlights: true, perPerson: false, insurance: true, internet: true, maxHours: 12 });
nativeTrip.preferences.passport = 'PRIVATE_PASSPORT_CANARY';
nativeTrip.flight.reservation = 'PRIVATE_RESERVATION_CANARY';
nativeTrip.hotel.reservation = 'PRIVATE_HOTEL_CANARY';
nativeTrip.notes = 'PRIVATE_TOPLEVEL_NOTE_CANARY';
const fromApplication = buildTripPDF(nativeTrip, nativeDestination, options);
assert.ok(fromApplication.pageCount <= 2, 'A trip created by the application remains compact');
await writeFile(resolve(out, 'voyconplan-desde-app.pdf'), Buffer.from(fromApplication.doc.output('arraybuffer')));
const damagedAssets = buildTripPDF(example.trip, example.destination, { assets: { logo: { data: new Uint8Array([1, 2, 3]), format: 'PNG' } } });
assert.ok(damagedAssets.warnings.length > 0, 'Malformed optional images fail gracefully');
await writeFile(resolve(out, 'pdf-qa-report.json'), JSON.stringify({ cases: report, edgeCases: ['missing fields', 'collapsed empty days', 'long notes', 'QR', 'input immutability', 'page bounds', 'real createTrip context', 'damaged image fallback'], result: 'passed' }, null, 2));
console.log(JSON.stringify(report, null, 2));
