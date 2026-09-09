import { jsPDF } from 'jspdf';

export type PdfImage = {
  data: string | Uint8Array;
  format?: 'PNG' | 'JPEG';
  credit?: string;
};
export type TripPdfAssets = {
  logo?: PdfImage;
  destination?: PdfImage;
  editorial?: PdfImage;
  qr?: PdfImage;
};
export type TripPdfFonts = { regular: string; semibold: string };
export type TripPdfOptions = {
  assets?: TripPdfAssets;
  fonts?: TripPdfFonts;
  generatedAt?: string;
  shareUrl?: string;
};
export type PdfLayoutBlock = {
  page: number;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type TripPdfResult = {
  doc: jsPDF;
  layout: PdfLayoutBlock[];
  pageCount: number;
  warnings: string[];
};

type Data = Record<string, unknown>;
type Activity = {
  title: string;
  time: string;
  duration: number | null;
  cost: number | null;
  category: string;
  notes: string;
  done: boolean;
};
type Day = { date: string; items: Activity[]; index: number };
type Check = { title: string; done: boolean };
type Trip = {
  title: string;
  destination: string;
  country: string;
  start: string;
  days: number;
  travelers: number;
  type: string;
  currency: string;
  demo: boolean;
  budget: number | null;
  planned: (number | null)[];
  spent: number;
  hasExpenses: boolean;
  itinerary: Day[];
  checklist: Check[];
  flight: Data;
  hotel: Data;
  pace: string;
  mapUrl: string | null;
};

const PAGE = { width: 210, height: 297, margin: 16, top: 31, bottom: 274 };
const WIDTH = PAGE.width - PAGE.margin * 2;
const COLOR = {
  forest: '#173F35',
  lime: '#DBED9E',
  cream: '#F7F6EE',
  white: '#FFFFFF',
  muted: '#5B7067',
  line: '#D7DED2',
  pale: '#EDF0E4',
};
const CATEGORIES = [
  'Vuelos', 'Alojamiento', 'Comida', 'Transporte', 'Actividades',
  'Documentación', 'Seguro', 'Internet / eSIM', 'Contingencia',
];
const record = (value: unknown): Data =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Data : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const numeric = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Keep readable travel text, including accents; strip unsupported emoji/control glyphs. */
function text(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const result = value
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\p{Extended_Pictographic}|[\uFE0F\u200D]/gu, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
  return result || fallback;
}

function date(value: unknown, weekday = false): string {
  const original = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(original)) return original || 'Fecha por definir';
  const parsed = new Date(original + 'T12:00:00Z');
  if (!Number.isFinite(parsed.getTime())) return 'Fecha por definir';
  return new Intl.DateTimeFormat('es', {
    day: 'numeric', month: 'short', ...(weekday ? { weekday: 'long' as const } : { year: 'numeric' as const }),
    timeZone: 'UTC',
  }).format(parsed).replace(/\./g, '');
}

function amount(value: number | null, currency: string): string {
  if (value === null) return 'Por definir';
  try {
    return new Intl.NumberFormat('es', {
      style: 'currency', currency, maximumFractionDigits: value % 1 ? 2 : 0,
    }).format(value).replace(/\u00A0/g, ' ');
  } catch {
    return new Intl.NumberFormat('es', { maximumFractionDigits: 2 }).format(value) + ' ' + currency;
  }
}

function normalize(input: unknown, destinationInput: unknown): Trip {
  const inputTrip = record(input), search = record(inputTrip.search);
  const destination = record(destinationInput), preferences = record(inputTrip.preferences);
  const itinerary = list(inputTrip.itinerary).map((item, index): Day => {
    const day = record(item);
    return {
      index: index + 1, date: text(day.date),
      items: list(day.items).map((entry): Activity => {
        const activity = record(entry);
        return {
          title: text(activity.title, 'Actividad por definir'), time: text(activity.time, 'Flexible'),
          duration: numeric(activity.duration), cost: numeric(activity.cost),
          category: text(activity.category), notes: text(activity.notes), done: activity.done === true,
        };
      }),
    };
  });
  const travelers = Math.max(1, numeric(search.travelers) || 1);
  const rawBudget = numeric(search.budget);
  const lat = numeric(destination.lat), lon = numeric(destination.lon);
  const code = text(search.currency, 'USD').toUpperCase();
  return {
    title: text(inputTrip.title, 'Mi próximo viaje'),
    destination: text(destination.name, text(inputTrip.destinationId, 'Destino por definir')),
    country: text(destination.country), start: text(search.date, itinerary[0]?.date || ''),
    days: Math.max(1, numeric(search.days) || itinerary.length || 1), travelers,
    type: text(search.type, 'Mi viaje'), currency: /^[A-Z]{3}$/.test(code) ? code : 'USD',
    demo: inputTrip.provenance !== 'user_entered',
    budget: rawBudget === null ? null : rawBudget * (search.perPerson === true ? travelers : 1),
    planned: CATEGORIES.map((_, index) => numeric(list(inputTrip.planned)[index])),
    spent: list(inputTrip.expenses).reduce<number>((sum, item) => sum + (numeric(record(item).amount) || 0), 0),
    hasExpenses: list(inputTrip.expenses).length > 0,
    itinerary,
    checklist: list(inputTrip.checklist).map((item) => {
      const entry = record(item);
      return { title: text(entry.title, 'Pendiente personal'), done: entry.done === true };
    }),
    flight: record(inputTrip.flight), hotel: record(inputTrip.hotel), pace: text(preferences.pace, 'A tu ritmo'),
    mapUrl: lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=13/${lat}/${lon}` : null,
  };
}

/** Measurement and pagination live here, so a content block never crosses a page. */
class Flow {
  readonly doc: jsPDF;
  readonly blocks: PdfLayoutBlock[] = [];
  readonly warnings: string[] = [];
  readonly assets: TripPdfAssets;
  readonly family: string;
  y = PAGE.top;
  page = 1;
  context = '';

  constructor(options: TripPdfOptions) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
    this.assets = options.assets || {};
    this.family = options.fonts ? 'InterPDF' : 'helvetica';
    if (options.fonts) {
      this.doc.addFileToVFS('InterPDF-Regular.ttf', options.fonts.regular);
      this.doc.addFont('InterPDF-Regular.ttf', 'InterPDF', 'normal');
      this.doc.addFileToVFS('InterPDF-Semibold.ttf', options.fonts.semibold);
      this.doc.addFont('InterPDF-Semibold.ttf', 'InterPDF', 'bold');
    }
    this.doc.setProperties({ title: 'Tu viaje | VoyConPlan', author: 'VoyConPlan', creator: 'VoyConPlan', subject: 'Guía personal de viaje' });
    if (options.generatedAt && Number.isFinite(Date.parse(options.generatedAt))) {
      this.doc.setCreationDate(new Date(options.generatedAt));
    }
    this.background();
  }

  font(size = 9, bold = false, color = COLOR.forest) {
    this.doc.setFont(this.family, bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(color);
  }

  lines(value: string, width: number, size = 9, bold = false): string[] {
    this.font(size, bold);
    return this.doc.splitTextToSize(text(value), width) as string[];
  }

  write(lines: string[] | string, x: number, y: number, size = 9, bold = false,
    color = COLOR.forest, leading = 4.3, align: 'left' | 'right' | 'center' = 'left') {
    this.font(size, bold, color);
    const values = Array.isArray(lines) ? lines : [text(lines)];
    values.forEach((value, index) => this.doc.text(value, x, y + index * leading, { align }));
  }

  image(asset: PdfImage | undefined, x: number, y: number, width: number, height: number, mode: 'cover' | 'contain' = 'cover') {
    if (!asset) return false;
    let saved = false;
    try {
      const info = this.doc.getImageProperties(asset.data);
      const ratio = mode === 'cover' ? Math.max(width / info.width, height / info.height) : Math.min(width / info.width, height / info.height);
      const w = info.width * ratio, h = info.height * ratio;
      this.doc.saveGraphicsState();
      saved = true;
      this.doc.rect(x, y, width, height, null);
      this.doc.clip();
      this.doc.discardPath();
      this.doc.addImage(asset.data, asset.format || (info.fileType === 'PNG' ? 'PNG' : 'JPEG'), x + (width - w) / 2, y + (height - h) / 2, w, h, undefined, 'FAST');
      this.doc.restoreGraphicsState();
      saved = false;
      return true;
    } catch {
      // Invalid optional imagery must not prevent a traveler exporting their plan.
      if (saved) this.doc.restoreGraphicsState();
      this.warnings.push('No se pudo incorporar una imagen opcional.');
      return false;
    }
  }

  background() {
    this.doc.setFillColor(COLOR.cream);
    this.doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
    if (!this.image(this.assets.logo, PAGE.margin, 9, 45, 15, 'contain')) {
      this.write('VoyConPlan', PAGE.margin, 19, 18, true);
    }
    this.write(this.context || 'TU VIAJE, CON PLAN.', PAGE.width - PAGE.margin, 17.5, 7.3, true, COLOR.muted, 4, 'right');
    this.doc.setDrawColor(COLOR.line);
    this.doc.setLineWidth(0.25);
    this.doc.line(PAGE.margin, 26, PAGE.width - PAGE.margin, 26);
  }

  next() {
    this.doc.addPage();
    this.page++;
    this.y = PAGE.top;
    this.background();
  }

  ensure(height: number) {
    if (this.y + height > PAGE.bottom && this.y > PAGE.top + 0.1) this.next();
  }

  block(kind: string, height: number, draw: (x: number, y: number) => void, gap = 4) {
    if (height > PAGE.bottom - PAGE.top) throw new Error(`PDF block too tall: ${kind}`);
    this.ensure(height);
    const y = this.y;
    draw(PAGE.margin, y);
    this.blocks.push({ page: this.page, kind, x: PAGE.margin, y, width: WIDTH, height });
    this.y += height + gap;
  }

  heading(title: string, subtitle = '', following = 20) {
    const detail = subtitle ? this.lines(subtitle, WIDTH, 8.1) : [];
    const height = 9 + detail.length * 3.8;
    this.ensure(height + following);
    this.block('heading:' + title, height, (x, y) => {
      this.doc.setFillColor(COLOR.lime);
      this.doc.roundedRect(x, y + 0.4, 3, 5.5, 1.2, 1.2, 'F');
      this.write(title, x + 6, y + 5, 14, true);
      if (detail.length) this.write(detail, x, y + 11, 8.1, false, COLOR.muted, 3.8);
    }, 2);
  }

  paragraph(value: string, kind = 'paragraph', size = 8.4, color = COLOR.muted) {
    const lines = this.lines(value, WIDTH, size);
    const leading = size * 0.46;
    while (lines.length) {
      this.ensure(leading + 2);
      const count = Math.max(1, Math.floor((PAGE.bottom - this.y - 2) / leading));
      const part = lines.splice(0, count);
      this.block(kind, part.length * leading + 1, (x, y) => this.write(part, x, y + leading - 0.5, size, false, color, leading), 3);
    }
  }

  box(x: number, y: number, width: number, height: number, fill = COLOR.white) {
    this.doc.setFillColor(fill);
    this.doc.roundedRect(x, y, width, height, 3, 3, 'F');
  }

  finish(trip: Trip, generatedAt?: string) {
    const count = this.doc.getNumberOfPages();
    const stamp = generatedAt && Number.isFinite(Date.parse(generatedAt))
      ? new Intl.DateTimeFormat('es', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(generatedAt)) : null;
    for (let page = 1; page <= count; page++) {
      this.doc.setPage(page);
      this.doc.setDrawColor(COLOR.line);
      this.doc.line(PAGE.margin, 280, PAGE.width - PAGE.margin, 280);
      this.write(trip.demo ? 'DEMO · Costos orientativos. Requisitos y disponibilidad sin verificar.' : 'Plan personal · Verifica requisitos, horarios y reservas antes de viajar.', PAGE.margin, 285, 6.8, false, COLOR.muted);
      this.write(stamp ? 'VoyConPlan · ' + stamp : 'VoyConPlan · Guía personal de viaje', PAGE.margin, 290, 6.8, true, COLOR.muted);
      this.write(`${page} / ${count}`, PAGE.width - PAGE.margin, 290, 7, true, COLOR.forest, 4, 'right');
    }
    this.doc.setPage(count);
    this.doc.setProperties({ title: trip.title + ' | VoyConPlan' });
  }
}

function intro(flow: Flow, trip: Trip) {
  const titleSize = trip.title.length > 75 ? 22 : 26;
  const title = flow.lines(trip.title, WIDTH, titleSize, true);
  const subtitle = [trip.destination, trip.country].filter(Boolean).join(', ');
  const meta = `${date(trip.start)} · ${trip.days} ${trip.days === 1 ? 'día' : 'días'} · ${trip.travelers} ${trip.travelers === 1 ? 'viajero' : 'viajeros'}`;
  const titleLeading = titleSize * 0.44;
  const metaLines = flow.lines(meta, WIDTH, 9);
  const h = 12 + title.length * titleLeading + metaLines.length * 4.2;
  // Titles are bounded in the application. This also remains safe for raw fixture inputs.
  if (h > 110) {
    flow.heading(subtitle || 'Tu guía de viaje');
    flow.paragraph(trip.title, 'long-trip-title', 17, COLOR.forest);
    flow.paragraph(meta, 'trip-meta', 9);
  } else {
    flow.block('intro', h, (x, y) => {
      flow.write(subtitle.toUpperCase(), x, y + 3, 8, true, COLOR.muted);
      flow.write(title, x, y + 12, titleSize, true, COLOR.forest, titleLeading);
      flow.write(metaLines, x, y + 14 + title.length * titleLeading, 9, false, COLOR.muted, 4.2);
    }, 4);
  }
  const hero = flow.assets.destination || flow.assets.editorial;
  if (hero) {
    const height = 32;
    flow.block('hero', height, (x, y) => {
      flow.box(x, y, WIDTH, height, COLOR.pale);
      flow.image(hero, x, y, WIDTH, height);
    }, 2);
    if (hero.credit) flow.paragraph(hero.credit, 'photo-credit', 6.5);
  }
}

function summary(flow: Flow, trip: Trip) {
  const known = trip.planned.filter((value): value is number => value !== null);
  const planned = known.length ? known.reduce((sum, value) => sum + value, 0) : null;
  const values = [
    { label: 'PRESUPUESTO DEL GRUPO', value: amount(trip.budget, trip.currency) },
    { label: trip.demo ? 'PLANIFICADO · DEMO' : 'PLANIFICADO', value: amount(planned, trip.currency) },
    { label: 'GASTOS REGISTRADOS', value: trip.hasExpenses ? amount(trip.spent, trip.currency) : 'Sin gastos aún' },
  ];
  const gap = 3, width = (WIDTH - gap * 2) / 3;
  flow.block('summary', 22, (x, y) => values.forEach((value, index) => {
    const left = x + index * (width + gap);
    flow.box(left, y, width, 22, index === 1 ? COLOR.lime : COLOR.white);
    flow.write(value.label, left + 4, y + 6, 6.5, true, COLOR.muted);
    let size = 15;
    flow.font(size, true);
    while (flow.doc.getTextWidth(value.value) > width - 8 && size > 9) { size--; flow.font(size, true); }
    flow.write(value.value, left + 4, y + 16, size, true);
  }), 4);
  flow.heading('Tu presupuesto, de un vistazo', trip.currency + ' · ' + trip.type + ' · ' + trip.pace, 45);
  flow.block('budget-table', 44, (x, y) => {
    flow.box(x, y, WIDTH, 44);
    const column = (WIDTH - 14) / 2;
    CATEGORIES.forEach((category, index) => {
      const side = index < 5 ? 0 : 1, row = index < 5 ? index : index - 5;
      const left = x + 5 + side * (column + 4), top = y + 7 + row * 7.1;
      flow.write(category, left, top, 8.2);
      const value = index === 5 && (trip.planned[index] === 0 || trip.planned[index] === null)
        ? 'Por verificar' : amount(trip.planned[index], trip.currency);
      flow.write(value, left + column - 4, top, 8.2, true, COLOR.forest, 4, 'right');
      if (row < (side === 0 ? 4 : 3)) {
        flow.doc.setDrawColor(COLOR.line);
        flow.doc.setLineWidth(0.15);
        flow.doc.line(left, top + 2.3, left + column - 4, top + 2.3);
      }
    });
  }, 3);
  flow.paragraph(trip.demo
    ? 'Las cifras de partida son DEMO. Documentación, tarifas y disponibilidad requieren comprobación; un importe sin definir no equivale a gratuidad.'
    : 'Importes introducidos en tu plan. Confirma las tarifas y los costos de documentación antes de reservar.', 'budget-source', 7.4);
}

function activity(flow: Flow, item: Activity, currency: string, dayLabel: string) {
  const innerWidth = WIDTH - 37;
  const titleLines = flow.lines(item.title, innerWidth, 10.3, true);
  const detail = [item.category, item.duration === null ? '' : `${item.duration} min`, item.cost === null ? 'Costo por definir' : amount(item.cost, currency)].filter(Boolean).join(' · ');
  const detailLines = flow.lines(detail, innerWidth, 7.7);
  const noteLines = item.notes ? flow.lines(item.notes, innerWidth, 8.2) : [];
  const maxLines = 46;
  // Normal cards stay whole; exceptionally long input gets explicitly labeled continuation cards.
  const chunks: { title: string[]; notes: string[]; continuation: boolean }[] = [];
  let titleRest = [...titleLines], notesRest = [...noteLines], continuation = false;
  do {
    const title = titleRest.splice(0, Math.min(8, titleRest.length));
    const notes = titleRest.length ? [] : notesRest.splice(0, Math.max(1, maxLines - title.length - detailLines.length));
    chunks.push({ title: title.length ? title : [item.title.length > 60 ? 'Continuación de la actividad' : item.title], notes, continuation });
    continuation = true;
  } while (titleRest.length || notesRest.length);
  for (const chunk of chunks) {
    const head = chunk.title.length * 4.5;
    const details = detailLines.length * 3.6;
    const noteHeight = chunk.notes.length ? chunk.notes.length * 3.9 + 2.3 : 0;
    const height = Math.max(19, 6 + head + details + noteHeight + (chunk.continuation ? 4 : 0));
    flow.block('activity:' + dayLabel, height, (x, y) => {
      flow.box(x, y, WIDTH, height);
      flow.doc.setFillColor(item.done ? COLOR.forest : COLOR.lime);
      flow.doc.roundedRect(x, y + 4, 1.7, height - 8, 0.7, 0.7, 'F');
      flow.write(chunk.continuation ? 'SIGUE' : item.time, x + 5, y + 8, 8.6, true);
      if (item.done && !chunk.continuation) flow.write('LISTO', x + 5, y + 13, 5.7, true, COLOR.muted);
      let at = y + 7;
      if (chunk.continuation) { flow.write(dayLabel + ' · Continuación', x + 30, at, 7, false, COLOR.muted); at += 4; }
      flow.write(chunk.title, x + 30, at, 10.3, true, COLOR.forest, 4.5);
      at += head + 0.8;
      flow.write(detailLines, x + 30, at, 7.7, false, COLOR.muted, 3.6);
      at += details + 2.3;
      if (chunk.notes.length) flow.write(chunk.notes, x + 30, at, 8.2, false, COLOR.forest, 3.9);
    }, 2);
  }
}

function firstActivityHeight(flow: Flow, first: Activity, currency: string) {
  const titles = flow.lines(first.title, WIDTH - 37, 10.3, true).length;
  const details = flow.lines([first.category, first.duration === null ? '' : `${first.duration} min`, first.cost === null ? 'Costo por definir' : amount(first.cost, currency)].filter(Boolean).join(' · '), WIDTH - 37, 7.7).length;
  const notes = titles > 8 ? 0 : Math.min(Math.max(1, 46 - titles - details), flow.lines(first.notes, WIDTH - 37, 8.2).length);
  return Math.max(19, 6 + Math.min(8, titles) * 4.5 + details * 3.6 + (first.notes && notes ? notes * 3.9 + 2.3 : 0));
}

function itinerary(flow: Flow, trip: Trip) {
  const firstActivity = trip.itinerary[0]?.items[0];
  flow.heading('Tu itinerario', 'Planes, pausas y pequeños descubrimientos. Horarios y trayectos por confirmar.',
    firstActivity ? 11 + firstActivityHeight(flow, firstActivity, trip.currency) : 20);
  if (!trip.itinerary.length) {
    flow.paragraph('Aún no has añadido actividades. Tu itinerario aparecerá aquí cuando completes el plan.', 'empty-itinerary');
    return;
  }
  let position = 0;
  while (position < trip.itinerary.length) {
    const day = trip.itinerary[position];
    flow.context = `DÍA ${String(day.index).padStart(2, '0')} · ${date(day.date)}`;
    if (!day.items.length) {
      const empty = [day];
      while (position + empty.length < trip.itinerary.length && !trip.itinerary[position + empty.length].items.length) empty.push(trip.itinerary[position + empty.length]);
      const label = empty.length === 1 ? `Día ${day.index} · ${date(day.date)}` : `Días ${day.index}-${empty[empty.length - 1].index} · ${date(day.date)} al ${date(empty[empty.length - 1].date)}`;
      const lines = flow.lines(label + '. Tiempo libre: actividades por definir.', WIDTH - 12, 8.3);
      flow.block('empty-days', 8 + lines.length * 4, (x, y) => {
        flow.box(x, y, WIDTH, 8 + lines.length * 4, COLOR.pale);
        flow.write(lines, x + 6, y + 7, 8.3, false, COLOR.muted, 4);
      }, 5);
      position += empty.length;
      continue;
    }
    const first = day.items[0];
    flow.ensure(11 + firstActivityHeight(flow, first, trip.currency));
    flow.block('day:' + day.index, 9, (x, y) => {
      flow.write(`DÍA ${String(day.index).padStart(2, '0')}`, x, y + 5, 7.6, true, COLOR.muted);
      flow.write(date(day.date, true), x + 20, y + 5, 10.2, true);
      flow.doc.setDrawColor(COLOR.line);
      flow.doc.line(x, y + 8, x + WIDTH, y + 8);
    }, 2);
    for (const item of day.items) activity(flow, item, trip.currency, 'Día ' + day.index);
    flow.y += 2;
    position++;
  }
  flow.context = '';
}

function reservation(flow: Flow, title: string, rows: string[]) {
  const content = rows.filter(Boolean);
  if (!content.length) return;
  const lines = content.flatMap((row) => flow.lines(row, WIDTH - 12, 8.4));
  const max = 51;
  while (lines.length) {
    const piece = lines.splice(0, max);
    const height = 14 + piece.length * 4.1;
    flow.block('reservation:' + title, height, (x, y) => {
      flow.box(x, y, WIDTH, height);
      flow.write(title, x + 6, y + 7, 10.1, true);
      flow.write(piece, x + 6, y + 13, 8.4, false, COLOR.muted, 4.1);
    }, 3);
  }
}

function reservations(flow: Flow, trip: Trip) {
  const flight = trip.flight, hotel = trip.hotel;
  const flightRows = [
    [text(flight.airline), text(flight.number)].filter(Boolean).join(' · '),
    text(flight.departure) ? 'Salida: ' + text(flight.departure) : '',
    text(flight.arrival) ? 'Llegada: ' + text(flight.arrival) : '',
  ];
  const hotelRows = [text(hotel.name), text(hotel.address), text(hotel.checkin) ? 'Check-in: ' + text(hotel.checkin) : ''];
  if (!flightRows.some(Boolean) && !hotelRows.some(Boolean)) return;
  flow.heading('Reservas a mano', 'Datos registrados por ti. Los códigos de reserva privados no se incluyen.', 24);
  reservation(flow, 'Cómo llegas', flightRows);
  reservation(flow, 'Dónde te quedas', hotelRows);
}

function checklist(flow: Flow, trip: Trip) {
  if (!trip.checklist.length) return;
  const done = trip.checklist.filter((item) => item.done).length;
  flow.heading('Antes de salir', `${done} de ${trip.checklist.length} pendientes completados. Marcar una casilla no verifica un requisito migratorio.`, 20);
  const column = (WIDTH - 5) / 2;
  for (let index = 0; index < trip.checklist.length; index += 2) {
    const pair = trip.checklist.slice(index, index + 2);
    const split = pair.map((item) => flow.lines(item.title, column - 15, 8.2));
    const maxLines = Math.max(...split.map((lines) => lines.length));
    if (maxLines > 48) {
      for (const item of pair) flow.paragraph((item.done ? '[Listo] ' : '[Pendiente] ') + item.title, 'long-checklist', 8.2, COLOR.forest);
      continue;
    }
    const height = Math.max(11, 6 + maxLines * 3.8);
    flow.block('checklist-row', height, (x, y) => pair.forEach((item, itemIndex) => {
      const left = x + itemIndex * (column + 5);
      flow.box(left, y, column, height, item.done ? COLOR.pale : COLOR.white);
      flow.doc.setDrawColor(COLOR.forest);
      flow.doc.setLineWidth(0.3);
      if (item.done) flow.doc.setFillColor(COLOR.forest);
      flow.doc.roundedRect(left + 4, y + 3.5, 3.3, 3.3, 0.6, 0.6, item.done ? 'FD' : 'S');
      if (item.done) {
        flow.doc.setDrawColor(COLOR.white);
        flow.doc.line(left + 4.6, y + 5.1, left + 5.2, y + 5.7);
        flow.doc.line(left + 5.2, y + 5.7, left + 6.6, y + 4.3);
      }
      flow.write(split[itemIndex], left + 10, y + 6.5, 8.2, false, COLOR.forest, 3.8);
    }), 2);
  }
}

function finalNotes(flow: Flow, trip: Trip, options: TripPdfOptions) {
  const note = 'Requisitos esenciales: visa, vigencia del pasaporte, tránsito, entrada, salud obligatoria y documentos de menores siguen SIN VERIFICAR. Consulta fuentes oficiales antes de viajar. Clima y tipos de cambio en vivo no consultados.';
  const lines = flow.lines(note, WIDTH - 12, 7.8);
  const height = 11 + lines.length * 3.6;
  flow.ensure(height + 5);
  flow.y += 3;
  flow.block('essential-requirements', height, (x, y) => {
    flow.box(x, y, WIDTH, height, COLOR.pale);
    flow.write('LO IMPORTANTE, SIEMPRE A MANO', x + 6, y + 6, 7, true);
    flow.write(lines, x + 6, y + 11, 7.8, false, COLOR.muted, 3.6);
  }, 4);
  const validShare = options.shareUrl && /^https?:\/\//i.test(options.shareUrl) ? options.shareUrl : null;
  if (validShare && flow.assets.qr) {
    flow.block('share-qr', 28, (x, y) => {
      flow.image(flow.assets.qr, x, y, 26, 26, 'contain');
      flow.write('Tu plan, también en el móvil.', x + 33, y + 8, 10, true);
      flow.write('Escanea para abrir la vista de lectura.', x + 33, y + 14, 8, false, COLOR.muted);
      flow.write('El enlace conserva sus permisos y fecha de caducidad.', x + 33, y + 19, 7.3, false, COLOR.muted);
      flow.doc.link(x, y, WIDTH, 26, { url: validShare });
    }, 3);
  }
  if (trip.mapUrl) {
    flow.ensure(8);
    flow.block('map-link', 6, (x, y) => {
      flow.write('Explorar ' + trip.destination + ' en OpenStreetMap', x, y + 4, 8, true);
      flow.doc.link(x, y, WIDTH, 6, { url: trip.mapUrl! });
    }, 0);
  }
}

/**
 * No fetch, document, download, storage, or input mutation. Callers inject image/font bytes.
 * The returned jsPDF instance can be saved in a browser or serialized in a Node fixture.
 */
export function buildTripPDF(input: unknown, destination: unknown, options: TripPdfOptions = {}): TripPdfResult {
  const trip = normalize(input, destination);
  const flow = new Flow(options);
  intro(flow, trip);
  summary(flow, trip);
  itinerary(flow, trip);
  reservations(flow, trip);
  checklist(flow, trip);
  finalNotes(flow, trip, options);
  flow.finish(trip, options.generatedAt);
  return { doc: flow.doc, layout: flow.blocks, pageCount: flow.doc.getNumberOfPages(), warnings: flow.warnings };
}

export const PDF_PAGE_BOUNDS = Object.freeze({ ...PAGE, contentWidth: WIDTH });
