import TravelOffers from '@/components/travel-offers';

export const metadata = {
  title: 'Vuelos y ofertas',
  description:
    'Explora ofertas publicadas de vuelos con sus rutas, precios y condiciones dentro de VoyConPlan. Consulta tarifas por fechas cuando la conexión esté activa.',
};

export default function OffersPage() {
  return <TravelOffers />;
}
