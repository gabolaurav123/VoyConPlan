import type {
  PromotionFeed,
  PromotionPlace,
  PublishedPromotion,
} from './promotion-types.ts';

export const PROMOTION_TTL_MS = 60 * 60 * 1000;
const FAILURE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 7000;
const MAX_RESPONSE_BYTES = 500_000;
const MAX_CONCURRENT_FETCHES = 2;

type PromotionSource = {
  id: string;
  url: string;
  origin: PromotionPlace;
  destination: PromotionPlace;
};

// Only these route pages were verified to publish a cash fare in their public HTML.
// SRZ is preserved as Avianca's city code; it does not assert an arrival at VVI.
export const PROMOTION_SOURCES: readonly PromotionSource[] = [
  {
    id: 'avianca-bog-lpb',
    url: 'https://www.avianca.com/co/es/vuelos-desde-bogota-a-la-paz',
    origin: { city: 'Bogotá', iata: 'BOG', kind: 'airport' },
    destination: { city: 'La Paz', iata: 'LPB', kind: 'airport' },
  },
  {
    id: 'avianca-bog-srz',
    url: 'https://www.avianca.com/co/es/vuelos-desde-bogota-a-santa-cruz',
    origin: { city: 'Bogotá', iata: 'BOG', kind: 'airport' },
    destination: { city: 'Santa Cruz, Bolivia', iata: 'SRZ', kind: 'city' },
  },
  {
    id: 'avianca-clo-lpb',
    url: 'https://www.avianca.com/co/es/vuelos-desde-cali-a-la-paz',
    origin: { city: 'Cali', iata: 'CLO', kind: 'airport' },
    destination: { city: 'La Paz', iata: 'LPB', kind: 'airport' },
  },
  {
    id: 'avianca-mde-lpb',
    url: 'https://www.avianca.com/co/es/vuelos-desde-medellin-a-la-paz',
    origin: { city: 'Medellín', iata: 'MDE', kind: 'airport' },
    destination: { city: 'La Paz', iata: 'LPB', kind: 'airport' },
  },
];

function visibleText(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, value: string) => {
      const point = Number(value);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function classText(html: string, tag: string, className: string) {
  const pattern = new RegExp(
    `<${tag}\\b[^>]*\\bclass=["'](?:[^"']*\\s)?${className}(?:\\s[^"']*)?["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,
    'gi',
  );
  const values: string[] = [];
  for (const match of html.matchAll(pattern)) {
    values.push(visibleText(match[1]));
  }
  return values;
}

export function parseAviancaPromotion(
  html: string,
  source: PromotionSource,
  checkedAtMs: number,
): PublishedPromotion | null {
  if (!Number.isFinite(checkedAtMs) || html.length > MAX_RESPONSE_BYTES)
    return null;
  const rendered = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const routes = classText(rendered, 'span', 'banner-route-p');
  const prices = classText(rendered, 'span', 'banner-price-p');
  const labels = classText(rendered, 'div', 'banner-subtitle-p');
  const cities = classText(rendered, 'span', 'hh-city');
  if (
    routes.length !== 1 ||
    prices.length !== 1 ||
    labels.length !== 1 ||
    routes[0] !== `${source.origin.city} a ${source.destination.city}` ||
    cities.length !== 2 ||
    cities[0] !== `${source.origin.city} (${source.origin.iata})` ||
    cities[1] !== `${source.destination.city} (${source.destination.iata})` ||
    labels[0] !== 'Ida y vuelta desde'
  )
    return null;

  // Read the cash banner only: mileage and the interactive one-way calendar have
  // independent fares and dates that must never be attached to this minimum.
  const priceMatch = prices[0].match(
    /^((?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?) COP$/,
  );
  if (!priceMatch) return null;
  const price = Number(priceMatch[1].replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000_000)
    return null;

  return {
    id: source.id,
    airline: 'Avianca',
    origin: { ...source.origin },
    destination: { ...source.destination },
    price: price.toFixed(2),
    currency: 'COP',
    tripType: 'round-trip',
    departureDate: null,
    returnDate: null,
    cabin: null,
    taxesIncluded: null,
    pointOfSale: 'Colombia',
    sourceUrl: source.url,
    checkedAt: new Date(checkedAtMs).toISOString(),
    expiresAt: new Date(checkedAtMs + PROMOTION_TTL_MS).toISOString(),
    notice:
      'Tarifa mínima publicada por Avianca para su mercado de Colombia, en pesos colombianos. No es una cotización para las fechas que elijas. Avianca indica que actualiza estas tarifas cada 24 horas; una revisión reciente de su página no implica una nueva cotización. La fuente no publica fechas concretas, cabina ni desglose de tasas para este importe. Precio por adulto, sujeto a disponibilidad y cambios; confirma las condiciones y el total antes de reservar.',
  };
}

async function boundedHtml(response: Response) {
  if (
    !response.ok ||
    !response.headers.get('content-type')?.includes('text/html')
  ) {
    throw new Error('Source unavailable');
  }
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
    throw new Error('Response too large');
  }
  if (!response.body) throw new Error('Missing response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let html = '';
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error('Response too large');
      html += decoder.decode(next.value, { stream: true });
    }
    return html + decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function createPromotionService(
  options: { fetch?: typeof fetch; now?: () => number } = {},
) {
  const fetcher = options.fetch || fetch;
  const now = options.now || Date.now;
  let cached: PromotionFeed | null = null;
  let inFlight: Promise<PromotionFeed> | null = null;

  async function refresh(): Promise<PromotionFeed> {
    const results = new Array<{
      offer: PublishedPromotion | null;
      checkedAt: string;
    }>(PROMOTION_SOURCES.length);
    let nextIndex = 0;
    async function worker() {
      while (nextIndex < PROMOTION_SOURCES.length) {
        const index = nextIndex++;
        const source = PROMOTION_SOURCES[index];
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        let offer: PublishedPromotion | null = null;
        try {
          const response = await fetcher(source.url, {
            signal: controller.signal,
            redirect: 'error',
            headers: { Accept: 'text/html' },
          });
          if (response.url && response.url !== source.url)
            throw new Error('Unexpected source URL');
          offer = parseAviancaPromotion(
            await boundedHtml(response),
            source,
            now(),
          );
        } catch {
          // Failed observations are never replaced with an old cached fare.
        } finally {
          clearTimeout(timeout);
        }
        results[index] = { offer, checkedAt: new Date(now()).toISOString() };
      }
    }
    await Promise.all(
      Array.from({ length: MAX_CONCURRENT_FETCHES }, () => worker()),
    );
    const checkedAt = now();
    const offers = results.flatMap(({ offer }) =>
      offer && Date.parse(offer.expiresAt) > checkedAt ? [offer] : [],
    );
    const retryAt =
      checkedAt +
      (offers.length === PROMOTION_SOURCES.length
        ? PROMOTION_TTL_MS
        : FAILURE_TTL_MS);
    const nextRefreshAt = Math.min(
      retryAt,
      ...offers.map((offer) => Date.parse(offer.expiresAt)),
    );
    return {
      offers,
      sources: PROMOTION_SOURCES.map((source, index) => ({
        id: source.id,
        name: `Avianca · ${source.origin.city} → ${source.destination.city}`,
        url: source.url,
        status: results[index].offer ? 'ok' : 'unavailable',
        checkedAt: results[index].checkedAt,
      })),
      checkedAt: new Date(checkedAt).toISOString(),
      nextRefreshAt: new Date(nextRefreshAt).toISOString(),
    };
  }

  return {
    async getFeed(): Promise<PromotionFeed> {
      if (cached && Date.parse(cached.nextRefreshAt) > now()) return cached;
      if (!inFlight) {
        inFlight = refresh()
          .then((feed) => {
            cached = feed;
            return feed;
          })
          .finally(() => {
            inFlight = null;
          });
      }
      return inFlight;
    },
  };
}

const service = createPromotionService();
export const getPromotionFeed = () => service.getFeed();
