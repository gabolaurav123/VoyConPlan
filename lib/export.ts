import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { categories, money, sharedProjection } from './domain';
export async function exportTripPDF(t: any, d: any, shareUrl?: string) {
  const doc = new jsPDF();
  let y = 20;
  const margin = 18;
  const line = (text: string, size = 11, bold = false) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, 174);
    for (const l of lines) {
      if (y > 277) {
        doc.addPage();
        y = 20;
      }
      doc.text(l, margin, y);
      y += size * 0.47 + 2;
    }
  };
  doc.setFillColor(24, 53, 54);
  doc.rect(0, 0, 210, 52, 'F');
  doc.setTextColor(255, 255, 255);
  line('VoyConPlan', 25, true);
  line('Tu viaje, con plan.', 12);
  y = 68;
  doc.setTextColor(24, 53, 54);
  line(t.title, 22, true);
  line(
    t.search.date +
      ' · ' +
      t.search.days +
      ' días · ' +
      t.search.travelers +
      ' viajeros',
    12,
  );
  if (d?.image) {
    try {
      const img = await fetch(d.image).then((r) => r.blob());
      const buffer = await img.arrayBuffer();
      doc.addImage(new Uint8Array(buffer), 'JPEG', margin, y, 174, 95);
      y += 103;
      line('Foto: ' + d.author + ' / Unsplash', 9);
    } catch {}
  }
  line(
    'Plan en preparación · ' +
      (t.provenance === 'demo' ? 'DEMO' : 'Datos introducidos manualmente'),
    11,
    true,
  );
  line(
    'Costos orientativos. Requisitos, disponibilidad, horarios y rutas no verificados. Comprueba las fuentes oficiales antes de reservar o viajar.',
  );
  if (shareUrl) {
    const qr = await QRCode.toDataURL(shareUrl);
    if (y > 230) {
      doc.addPage();
      y = 20;
    }
    doc.addImage(qr, 'PNG', margin, y, 30, 30);
    doc.link(margin, y, 30, 30, { url: shareUrl });
    y += 38;
    line('Enlace de lectura sujeto a caducidad y acceso al sitio.', 9);
  }
  doc.addPage();
  y = 20;
  line('Presupuesto', 18, true);
  line(
    'Moneda: ' +
      t.search.currency +
      ' · Cambios de ejemplo, no cotización actual.',
    10,
  );
  categories.forEach((c, i) =>
    line(
      c +
        ': ' +
        money(t.planned[i] || 0, t.search.currency) +
        (i === 5 ? ' (comprobar costos)' : ''),
    ),
  );
  line(
    'Gastos registrados: ' +
      money(
        t.expenses.reduce((a: number, e: any) => a + e.amount, 0),
        t.search.currency,
      ),
    12,
    true,
  );
  line('Reservas', 18, true);
  line('Vuelo: ' + (t.flight.airline || 'Pendiente') + ' ' + t.flight.number);
  line(
    'Salida: ' +
      (t.flight.departure || 'Pendiente') +
      ' · Llegada: ' +
      (t.flight.arrival || 'Pendiente'),
  );
  line('Alojamiento: ' + (t.hotel.name || 'Pendiente'));
  line('Dirección: ' + (t.hotel.address || 'Pendiente'));
  line('Los códigos de reserva privados se omiten en esta exportación.', 9);
  line('Requisitos de viaje', 18, true);
  line(
    'Visa, pasaporte, tránsito, entrada, salud y documentación de menores: SIN VERIFICAR. No se ha consultado un proveedor de requisitos. Clima y moneda: sin datos en vivo.',
  );
  for (const day of t.itinerary) {
    doc.addPage();
    y = 20;
    line(day.date, 18, true);
    if (!day.items.length) line('Día por planificar.');
    for (const item of day.items) {
      line(item.time + ' · ' + item.title, 12, true);
      line(item.duration + ' min · ' + money(item.cost, t.search.currency));
      if (item.notes) line(item.notes, 10);
    }
    if (d) {
      line('Mapa de ' + d.name, 11);
      doc.textWithLink('Abrir mapa en OpenStreetMap', margin, y, {
        url: 'https://www.openstreetmap.org/?mlat=' + d.lat + '&mlon=' + d.lon,
      });
      y += 12;
    }
  }
  doc.addPage();
  y = 20;
  line('Checklist', 18, true);
  t.checklist.forEach((c: any) => line((c.done ? '[X] ' : '[ ] ') + c.title));
  line(
    'Marcar un documento como listo no equivale a verificación migratoria.',
    10,
  );
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(110, 120, 110);
    doc.text('VoyConPlan · ' + i + ' / ' + doc.getNumberOfPages(), 18, 289);
  }
  doc.save('VoyConPlan-' + (d?.id || 'viaje') + '.pdf');
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
