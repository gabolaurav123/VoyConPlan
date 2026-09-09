export type Provenance = {
  provider: string;
  url?: string;
  fetchedAt: string | null;
  expiresAt: string | null;
  origin: 'live' | 'demo' | 'user_entered';
};
export type Result<T> =
  | { ok: true; data: T; source: Provenance }
  | {
      ok: false;
      code: 'NOT_CONFIGURED' | 'UNAVAILABLE' | 'INVALID_RESPONSE';
      message: string;
    };
export interface FlightSearchProvider {
  search(input: Record<string, unknown>): Promise<Result<unknown[]>>;
}
export interface AccommodationProvider {
  search(input: Record<string, unknown>): Promise<Result<unknown[]>>;
}
export interface PlacesProvider {
  search(input: Record<string, unknown>): Promise<Result<unknown[]>>;
}
export interface ActivityProvider extends PlacesProvider {}
export interface RoutesProvider {
  route(input: Record<string, unknown>): Promise<Result<unknown>>;
}
export interface TravelRequirementsProvider {
  check(input: Record<string, unknown>): Promise<Result<unknown[]>>;
}
export interface CurrencyProvider {
  rates(base: string): Promise<Result<Record<string, number>>>;
}
export interface WeatherProvider {
  forecast(input: Record<string, unknown>): Promise<Result<unknown>>;
}
export interface AIProvider {
  organize(input: Record<string, unknown>): Promise<Result<unknown>>;
}
export interface BillingProvider {
  checkout(input: Record<string, unknown>): Promise<Result<{ url: string }>>;
}
export interface AffiliateProvider {
  link(input: Record<string, unknown>): Promise<Result<{ url: string }>>;
}
export interface NotificationProvider {
  send(input: Record<string, unknown>): Promise<Result<{ id: string }>>;
}
export interface ImageGenerationProvider {
  generate(input: Record<string, unknown>): Promise<Result<{ url: string }>>;
}
export interface AnalyticsProvider {
  track(input: Record<string, unknown>): Promise<Result<unknown>>;
}
export const providerList = [
  ['Flights', 'Duffel / Amadeus'],
  ['Accommodation', 'Proveedor de alojamiento'],
  ['Places', 'Proveedor de lugares'],
  ['Activities', 'Proveedor de experiencias'],
  ['Routes', 'Proveedor de rutas'],
  ['Requirements', 'Proveedor de requisitos oficiales'],
  ['Currency', 'Proveedor de tipos de cambio'],
  ['Weather', 'Proveedor meteorológico'],
  ['AI', 'Modelo de organización'],
  ['Billing', 'Lemon Squeezy'],
  ['Notifications', 'Proveedor de correo'],
  ['Images', 'Generación de imágenes'],
  ['Affiliates', 'Redes de afiliados'],
  ['Analytics', 'Eventos propios'],
];
export function unavailable(name: string): Result<never> {
  return {
    ok: false,
    code: 'NOT_CONFIGURED',
    message:
      name +
      ': proveedor no conectado. No se ha consultado disponibilidad ni información en tiempo real.',
  };
}
export class DuffelAdapter implements FlightSearchProvider {
  async search() {
    return unavailable('Duffel');
  }
}
export class AmadeusAdapter implements FlightSearchProvider {
  async search() {
    return unavailable('Amadeus');
  }
}
export class LemonSqueezyAdapter implements BillingProvider {
  async checkout() {
    return unavailable('Lemon Squeezy');
  }
}
export function essentialRequirements() {
  return [
    'Visa y autorización de entrada',
    'Vigencia del pasaporte',
    'Condiciones de tránsito y escalas',
    'Boleto de salida y alojamiento',
    'Requisitos sanitarios obligatorios',
    'Documentos para menores',
  ].map((title) => ({
    title,
    status: 'unknown',
    severity: 'critical',
    source: null,
    checkedAt: null,
    message:
      'Pendiente de verificar con una fuente oficial para tu pasaporte, residencia y trayecto.',
  }));
}
