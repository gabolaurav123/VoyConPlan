import { sharedProjection } from './domain';
import { buildTripPDF } from './pdf/trip-pdf';
import { loadTripPdfAssets } from './pdf/assets';
export { buildTripPDF } from './pdf/trip-pdf';

/** Browser entry point; PDF composition remains pure and usable in Node fixtures. */
export async function exportTripPDF(trip: unknown, destination: unknown, shareUrl?: string) {
  const loaded = await loadTripPdfAssets(destination, shareUrl);
  const { doc } = buildTripPDF(trip, destination, { ...loaded, shareUrl, generatedAt: new Date().toISOString() });
  const rawId = trip && typeof trip === 'object' && 'destinationId' in trip ? String(trip.destinationId) : 'mi-viaje';
  const slug = rawId.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 60) || 'mi-viaje';
  doc.save('VoyConPlan-' + slug + '.pdf');
}

const esc = (s: string) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
export function downloadOffline(t: any) {
  const p = sharedProjection(t);
  const html =
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>' +
    esc(t.title) +
    ' | VoyConPlan</title><style>body{max-width:760px;margin:40px auto;padding:20px;font:17px/1.7 system-ui;color:#183536}h1{font-size:34px}section{border-top:1px solid #ccc;margin-top:25px;padding-top:15px}small{color:#566}</style><h1>VoyConPlan</h1><h2>' +
    esc(t.title) +
    '</h2><p>Copia de lectura. Generada ' +
    esc(new Date().toISOString()) +
    '. No recibe actualizaciones.</p><p>DEMO / datos manuales. Requisitos, rutas, clima y disponibilidad sin verificar.</p>' +
    p.itinerary
      .map(
        (d: any) =>
          '<section><h2>' +
          esc(d.date) +
          '</h2>' +
          d.items
            .map(
              (i: any) =>
                '<p><b>' +
                esc(i.time) +
                '</b> ' +
                esc(i.title) +
                ' · ' +
                i.duration +
                ' min</p>',
            )
            .join('') +
          '</section>',
      )
      .join('') +
    '<section><h2>Checklist</h2>' +
    t.checklist
      .map(
        (c: any) => '<p>' + (c.done ? '✓' : '□') + ' ' + esc(c.title) + '</p>',
      )
      .join('') +
    '</section></html>';
  download(
    new Blob([html], { type: 'text/html;charset=utf-8' }),
    'VoyConPlan-viaje-offline.html',
  );
}
export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
