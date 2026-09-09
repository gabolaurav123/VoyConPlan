import TravelOffers from '@/components/travel-offers';

export const metadata = {
  title: 'Vuelos y ofertas',
  description:
    'Busca vuelos por origen, destino y fechas. Compara los importes totales, las escalas y la vigencia de las tarifas disponibles.',
};

export default function OffersPage() {
  return <TravelOffers />;
}
