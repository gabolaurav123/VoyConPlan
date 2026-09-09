export type TravelMode = 'live' | 'test';
export type TravelSearchInput = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
  maxConnections: number;
};
export type TravelSegment = {
  origin: string;
  destination: string;
  departureAt: string;
  arrivalAt: string;
  operatingCarrier: string;
  flightNumber: string;
  duration: string | null;
};
export type TravelOffer = {
  id: string;
  provider: 'Duffel';
  mode: TravelMode;
  dataKind: 'live' | 'simulated';
  price: { amount: string; currency: string; totalPassengers: number };
  consultedAt: string;
  expiresAt: string;
  carrierName: string;
  operatingCarriers: string[];
  slices: { origin: string; destination: string; duration: string | null; segments: TravelSegment[] }[];
  availability: 'subject_to_confirmation';
  bookingAvailable: false;
};
export type TravelSearchResult = {
  provider: 'Duffel';
  mode: TravelMode;
  dataKind: 'live' | 'simulated';
  consultedAt: string;
  expiresAt: string | null;
  cached: boolean;
  query: TravelSearchInput;
  offers: TravelOffer[];
  message: string;
};
export type TravelStatus = {
  provider: 'Duffel';
  available: boolean;
  mode: TravelMode | 'unavailable';
  message: string;
  cacheSeconds: number;
  bookingAvailable: false;
  coverage: string;
};
