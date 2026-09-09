export type PromotionPlace = {
  city: string;
  iata: string;
  kind: 'airport' | 'city';
};

export type PublishedPromotion = {
  id: string;
  airline: string;
  origin: PromotionPlace;
  destination: PromotionPlace;
  price: string;
  currency: string;
  tripType: 'round-trip' | 'one-way';
  departureDate: string | null;
  returnDate: string | null;
  cabin: string | null;
  taxesIncluded: boolean | null;
  pointOfSale: string;
  sourceUrl: string;
  checkedAt: string;
  /** Maximum age of this observation, not the airline's promotion validity. */
  expiresAt: string;
  notice: string;
};

export type PromotionFeed = {
  offers: PublishedPromotion[];
  sources: {
    id: string;
    name: string;
    url: string;
    status: 'ok' | 'unavailable';
    checkedAt: string;
  }[];
  checkedAt: string;
  nextRefreshAt: string;
};
