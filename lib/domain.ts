export type Search = {
  origin: string;
  budget: number;
  currency: string;
  travelers: number;
  days: number;
  date: string;
  type: string;
  interests: string[];
  includeFlights: boolean;
  perPerson: boolean;
  insurance: boolean;
  internet: boolean;
  maxHours: number;
};
export type Destination = {
  id: string;
  name: string;
  country: string;
  code: string;
  lat: number;
  lon: number;
  timezone: string;
  tags: string[];
  description: string;
  costs: number[];
  flightHours: number;
  image: string;
  author: string;
  source: string;
};
export const currencies: Record<string, number> = {
  USD: 1,
  BOB: 6.96,
  EUR: 0.92,
};
export const categories = [
  'Vuelos',
  'Alojamiento',
  'Comida',
  'Transporte',
  'Actividades',
  'Documentación',
  'Seguro',
  'Internet',
  'Contingencia',
];
export const origins = [
  'La Paz, Bolivia',
  'Santa Cruz, Bolivia',
  'Lima, Perú',
  'Bogotá, Colombia',
  'Madrid, España',
];
export const demoDestinations: Destination[] = [
  {
    id: 'cartagena',
    name: 'Cartagena',
    country: 'Colombia',
    code: 'CO',
    lat: 10.391,
    lon: -75.479,
    timezone: 'America/Bogota',
    tags: ['Playa', 'Gastronomía', 'En pareja', 'Cultura'],
    description:
      'Calles de colores, atardeceres junto al mar y una ciudad para recorrer sin prisa.',
    costs: [290, 45, 19, 7, 15],
    flightHours: 7,
    image: '/images/cartagena.jpg',
    author: 'Ricky Beron',
    source: 'https://unsplash.com/photos/acH94SHbWS4',
  },
  {
    id: 'cusco',
    name: 'Cusco',
    country: 'Perú',
    code: 'PE',
    lat: -13.532,
    lon: -71.967,
    timezone: 'America/Lima',
    tags: ['Montaña', 'Cultura', 'Aventura', 'Naturaleza'],
    description:
      'Historia andina, paisajes de altura y mercados llenos de vida.',
    costs: [165, 32, 14, 5, 17],
    flightHours: 4,
    image: '/images/cusco.jpg',
    author: 'Kieran Proctor',
    source: 'https://unsplash.com/photos/Pf-m6pg5hcE',
  },
  {
    id: 'buenos-aires',
    name: 'Buenos Aires',
    country: 'Argentina',
    code: 'AR',
    lat: -34.604,
    lon: -58.382,
    timezone: 'America/Argentina/Buenos_Aires',
    tags: ['Ciudad', 'Gastronomía', 'Cultura', 'En pareja'],
    description:
      'Cafés, barrios con carácter y tardes que se convierten en noches de tango.',
    costs: [235, 43, 20, 6, 12],
    flightHours: 5,
    image: '/images/buenos-aires.jpg',
    author: 'Gustavo Sánchez',
    source: 'https://unsplash.com/photos/j1Yx11T0UI0',
  },
  {
    id: 'rio-de-janeiro',
    name: 'Río de Janeiro',
    country: 'Brasil',
    code: 'BR',
    lat: -22.907,
    lon: -43.173,
    timezone: 'America/Sao_Paulo',
    tags: ['Playa', 'Naturaleza', 'Aventura', 'En familia'],
    description:
      'La ciudad, la montaña y el mar se encuentran en un mismo paisaje.',
    costs: [360, 56, 23, 10, 18],
    flightHours: 8,
    image: '/images/rio-de-janeiro.jpg',
    author: 'Raissa Brizeno',
    source: 'https://unsplash.com/photos/WIW4ZMFd6ds',
  },
  {
    id: 'ciudad-de-mexico',
    name: 'Ciudad de México',
    country: 'México',
    code: 'MX',
    lat: 19.433,
    lon: -99.133,
    timezone: 'America/Mexico_City',
    tags: ['Ciudad', 'Cultura', 'Gastronomía', 'En familia'],
    description:
      'Arte, barrios caminables y sabores para llenar cada día de descubrimientos.',
    costs: [420, 49, 21, 8, 16],
    flightHours: 10,
    image: '/images/ciudad-de-mexico.jpg',
    author: 'Azahed',
    source: 'https://unsplash.com/photos/nBF5BB13iM0',
  },
  {
    id: 'lisboa',
    name: 'Lisboa',
    country: 'Portugal',
    code: 'PT',
    lat: 38.722,
    lon: -9.139,
    timezone: 'Europe/Lisbon',
    tags: ['Ciudad', 'Cultura', 'En pareja', 'Gastronomía'],
    description:
      'Colinas, miradores y paseos junto al río con una pausa para un café.',
    costs: [920, 89, 34, 12, 25],
    flightHours: 18,
    image: '/images/lisboa.jpg',
    author: 'Frank Eiffert',
    source: 'https://unsplash.com/photos/QyBT76O1Jvo',
  },
];
export const defaultSearch: Search = {
  origin: origins[0],
  budget: 1500,
  currency: 'USD',
  travelers: 2,
  days: 6,
  date: '2026-11-09',
  type: 'En pareja',
  interests: [],
  includeFlights: true,
  perPerson: false,
  insurance: false,
  internet: false,
  maxHours: 24,
};
export function validNumber(
  v: unknown,
  min: number,
  max: number,
  integer = false,
) {
  const n = Number(v);
  if (
    !Number.isFinite(n) ||
    n < min ||
    n > max ||
    (integer && !Number.isInteger(n))
  )
    throw new Error('Revisa los valores numéricos.');
  return n;
}
export function validateSearch(x: any): Search {
  if (
    !x ||
    !origins.includes(x.origin) ||
    typeof x.currency !== 'string' ||
    !Object.hasOwn(currencies, x.currency) ||
    !['Solo', 'En pareja', 'En familia'].includes(x.type) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(x.date) ||
    !Number.isFinite(Date.parse(x.date + 'T12:00:00Z')) ||
    new Date(x.date + 'T12:00:00Z').toISOString().slice(0, 10) !== x.date
  )
    throw new Error('Revisa origen, moneda y fecha.');
  return {
    origin: x.origin,
    budget: validNumber(x.budget, 50, 1000000),
    currency: x.currency,
    travelers: validNumber(x.travelers, 1, 12, true),
    days: validNumber(x.days, 1, 30, true),
    date: x.date,
    type: x.type,
    interests: Array.isArray(x.interests)
      ? x.interests.filter((v: any) => typeof v === 'string').slice(0, 12)
      : [],
    includeFlights: !!x.includeFlights,
    perPerson: !!x.perPerson,
    insurance: !!x.insurance,
    internet: !!x.internet,
    maxHours: validNumber(x.maxHours || 24, 1, 48),
  };
}
export function estimate(d: Destination, s: Search) {
  const people = s.travelers,
    nights = Math.max(0, s.days - 1),
    rooms = Math.ceil(people / 2),
    rate = currencies[s.currency];
  const originFactor =
    [1, 0.9, 0.78, 0.7, 1.35][origins.indexOf(s.origin)] ?? 1;
  const base = [
    s.includeFlights ? d.costs[0] * people * originFactor : 0,
    d.costs[1] * nights * rooms,
    d.costs[2] * s.days * people,
    d.costs[3] * s.days * people,
    d.costs[4] * s.days * people,
    0,
    s.insurance ? 4 * s.days * people : 0,
    s.internet ? 18 * people : 0,
  ];
  const subtotal = base.reduce((a, b) => a + b, 0);
  base.push(subtotal * 0.1);
  const amounts = base.map((v) => Math.round(v * rate * 100) / 100),
    real = Math.round(amounts.reduce((a, b) => a + b, 0)),
    economic = Math.round(real * 0.78),
    comfortable = Math.round(real * 1.28),
    budget = s.budget * (s.perPerson ? people : 1),
    ratio = real / budget;
  const matches = s.interests.filter((i) => d.tags.includes(i)),
    interestFit = s.interests.length
      ? matches.length / s.interests.length
      : 0.6;
  const score = Math.round(
    65 * Math.min(1, budget / real) +
      25 * interestFit +
      10 * Math.min(1, s.days / 5),
  );
  const level =
    ratio <= 0.8
      ? 'green'
      : ratio <= 1
        ? 'yellow'
        : ratio <= 1.15
          ? 'orange'
          : 'red';
  const labels = {
    green: 'Entra con margen',
    yellow: 'Dentro de tu presupuesto',
    orange: 'Muy ajustado',
    red: 'Fuera del presupuesto',
  };
  return {
    ...d,
    amounts,
    real,
    economic,
    comfortable,
    score,
    level,
    label: labels[level],
    budget,
    matches,
    daily: Math.round((real - amounts[0]) / s.days / people),
    costSource: 'Catálogo DEMO VoyConPlan · v1',
    checkedAt: null,
    missing: [
      'Visa y documentación: costo sin verificar',
      'Disponibilidad, requisitos y horarios sin verificar',
    ],
    explanation: matches.length
      ? 'Coincide con ' +
        matches.join(' y ') +
        '. El costo completo representa ' +
        Math.round(ratio * 100) +
        '% de tu presupuesto.'
      : 'El costo completo representa ' +
        Math.round(ratio * 100) +
        '% de tu presupuesto. Ajusta tus intereses para personalizar la afinidad.',
  };
}
export function discover(ds: Destination[], s: Search) {
  return ds
    .map((d) => estimate(d, s))
    .filter((d) => d.flightHours <= s.maxHours)
    .sort((a, b) => b.score - a.score || a.real - b.real);
}
export function money(v: number, currency = 'USD') {
  return new Intl.NumberFormat('es', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}
export function dateAt(start: string, day: number) {
  const d = new Date(start + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + day);
  return d.toISOString().slice(0, 10);
}
export function createTrip(d: Destination, s: Search) {
  const est = estimate(d, s);
  return {
    destinationId: d.id,
    title:
      s.type === 'En pareja'
        ? 'Nuestra escapada a ' + d.name
        : 'Mi viaje a ' + d.name,
    search: s,
    status: 'Planificando',
    preferences: {
      pace: 'Equilibrado',
      accommodation: 'Hotel',
      occasion: 'Vacaciones',
      passport: '',
      residence: '',
      transit: '',
      childrenAges: '',
      diet: '',
      mobility: '',
    },
    itinerary: Array.from({ length: s.days }, (_, i) => ({
      date: dateAt(s.date, i),
      items:
        i === 0
          ? [
              {
                id: crypto.randomUUID(),
                time: '16:00',
                duration: 90,
                title: 'Llegada y descanso — ajusta a tu vuelo',
                cost: 0,
                notes:
                  'Bloque orientativo. Confirma llegada y check-in antes de añadir actividades.',
                category: 'Descanso',
                done: false,
              },
            ]
          : [],
    })),
    expenses: [],
    checklist: [
      'Verificar requisitos oficiales de entrada y tránsito',
      'Revisar vigencia del pasaporte',
      'Confirmar vuelos y equipaje',
      'Confirmar alojamiento y check-in',
      'Revisar seguro de viaje',
      'Preparar documentos y copias',
      'Preparar equipaje y cargadores',
    ].map((title) => ({ id: crypto.randomUUID(), title, done: false })),
    planned: est.amounts,
    flight: {
      airline: '',
      number: '',
      departure: '',
      arrival: '',
      reservation: '',
    },
    hotel: { name: '', address: '', checkin: '', reservation: '' },
    provenance: 'demo',
    createdAt: new Date().toISOString(),
  };
}
export function validateTrip(x: any) {
  if (
    !x ||
    typeof x.title !== 'string' ||
    x.title.trim().length < 2 ||
    x.title.length > 120
  )
    throw new Error('El nombre del viaje debe tener entre 2 y 120 caracteres.');
  const search = validateSearch(x.search);
  if (
    !Array.isArray(x.itinerary) ||
    x.itinerary.length > 30 ||
    !Array.isArray(x.expenses) ||
    x.expenses.length > 500 ||
    !Array.isArray(x.checklist) ||
    x.checklist.length > 100
  )
    throw new Error('El viaje supera los límites permitidos.');
  const clean = (v: any, max = 1000) =>
    typeof v === 'string' ? v.slice(0, max) : '';
  const itinerary = x.itinerary.map((day: any) => {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
      !Array.isArray(day.items) ||
      day.items.length > 25
    )
      throw new Error('Día inválido.');
    const items = day.items
      .map((i: any) => {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(i.time))
          throw new Error('Hora inválida.');
        return {
          id: clean(i.id, 80),
          title: clean(i.title, 150),
          time: i.time,
          duration: validNumber(i.duration, 5, 720, true),
          cost: validNumber(i.cost, 0, 1000000),
          category: clean(i.category, 60),
          notes: clean(i.notes),
          done: !!i.done,
        };
      })
      .sort((a: any, b: any) => a.time.localeCompare(b.time));
    for (let n = 1; n < items.length; n++) {
      const prev = items[n - 1],
        curr = items[n];
      const mins = (v: string) =>
        Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
      if (mins(prev.time) + prev.duration > mins(curr.time))
        throw new Error(
          'Hay actividades que se superponen. Ajusta su hora o duración.',
        );
    }
    return { date: day.date, items };
  });
  const preferences = Object.fromEntries(
    [
      'pace',
      'accommodation',
      'occasion',
      'passport',
      'residence',
      'transit',
      'childrenAges',
      'diet',
      'mobility',
    ].map((k) => [k, clean(x.preferences?.[k], 150)]),
  );
  return {
    title: x.title.trim(),
    destinationId: clean(x.destinationId, 80),
    search,
    status: ['Planificando', 'En viaje', 'Finalizado'].includes(x.status)
      ? x.status
      : 'Planificando',
    preferences,
    itinerary,
    expenses: x.expenses.map((e: any) => ({
      id: clean(e.id, 80),
      title: clean(e.title, 100),
      amount: validNumber(e.amount, 0.01, 1000000),
      category: clean(e.category, 50),
      payer: ['Yo', 'Mi pareja', 'Compartido'].includes(e.payer)
        ? e.payer
        : 'Yo',
      date: clean(e.date, 10),
    })),
    checklist: x.checklist.map((c: any) => ({
      id: clean(c.id, 80),
      title: clean(c.title, 200),
      done: !!c.done,
    })),
    planned: Array.isArray(x.planned)
      ? x.planned.slice(0, 9).map((v: any) => validNumber(v, 0, 1000000))
      : [],
    flight: Object.fromEntries(
      ['airline', 'number', 'departure', 'arrival', 'reservation'].map((k) => [
        k,
        clean(x.flight?.[k], 100),
      ]),
    ),
    hotel: Object.fromEntries(
      ['name', 'address', 'checkin', 'reservation'].map((k) => [
        k,
        clean(x.hotel?.[k], 200),
      ]),
    ),
    provenance: x.provenance === 'user_entered' ? 'user_entered' : 'demo',
    createdAt: clean(x.createdAt, 40),
  };
}
export function sharedProjection(t: any) {
  return {
    title: t.title,
    destinationId: t.destinationId,
    search: { date: t.search.date, days: t.search.days, type: t.search.type },
    itinerary: t.itinerary.map((d: any) => ({
      date: d.date,
      items: d.items.map((i: any) => ({
        title: i.title,
        time: i.time,
        duration: i.duration,
        category: i.category,
      })),
    })),
    provenance: t.provenance,
    requirements: 'No verificados. Consulta fuentes oficiales.',
  };
}
export function preferenceMatches(
  a: Record<string, string>,
  b: Record<string, string>,
) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].map((key) => ({
    key,
    a: a[key] || 'Neutral',
    b: b[key] || 'Neutral',
    status:
      a[key] === 'Evitar' || b[key] === 'Evitar'
        ? 'Uno prefiere evitarlo'
        : a[key] === 'Imprescindible' || b[key] === 'Imprescindible'
          ? 'Imprescindible'
          : a[key] === 'Me gusta' && b[key] === 'Me gusta'
            ? 'Ambos quieren hacerlo'
            : a[key] === 'Me gusta' || b[key] === 'Me gusta'
              ? 'Le gusta a uno'
              : 'Neutral',
  }));
}
