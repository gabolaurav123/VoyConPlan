'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Clock3,
  Info,
  LoaderCircle,
  Plane,
  RefreshCw,
  Search,
} from 'lucide-react';
import type {
  PromotionFeed,
  PublishedPromotion,
} from '@/lib/travel/promotion-types';
import './published-offers.css';

function dateLabel(value: string) {
  return new Date(
    value.length === 10 ? value + 'T12:00:00Z' : value,
  ).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function PromotionCard({ offer }: { offer: PublishedPromotion }) {
  const price = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: offer.currency,
    currencyDisplay: 'code',
    maximumFractionDigits: 2,
  }).format(Number(offer.price));
  return (
    <article className="published-offer-card">
      <div className="published-offer-top">
        <span>
          <Plane size={17} />
          {offer.airline}
        </span>
        <small>Tarifa publicada</small>
      </div>
      <div className="published-offer-route">
        <span>
          {offer.origin.city}
          <small>{offer.origin.iata}</small>
        </span>
        <ArrowRight size={22} />
        <span>
          {offer.destination.city}
          <small>{offer.destination.iata}</small>
        </span>
      </div>
      <p className="published-offer-trip">
        {offer.tripType === 'round-trip' ? 'Ida y vuelta' : 'Solo ida'}
        {offer.cabin ? ' · ' + offer.cabin : ''} · Sitio de {offer.pointOfSale}
      </p>
      <div className="published-offer-price">
        <span>Desde</span>
        <strong>{price}</strong>
      </div>
      <p className="published-offer-dates">
        <CalendarDays size={17} />
        {offer.departureDate
          ? dateLabel(offer.departureDate) +
            (offer.returnDate ? ' — ' + dateLabel(offer.returnDate) : '')
          : 'Fechas sujetas a disponibilidad'}
      </p>
      <details className="published-offer-details">
        <summary>
          Ver condiciones aquí <ChevronDown size={17} />
        </summary>
        <div>
          <p>{offer.notice}</p>
          <p>
            {offer.taxesIncluded === true
              ? 'La fuente indica impuestos incluidos. '
              : offer.taxesIncluded === false
                ? 'La fuente indica impuestos no incluidos. '
                : ''}
            Confirma equipaje, extras y condiciones para tu país de compra.
          </p>
          <p className="published-offer-checked">
            <Clock3 size={14} />
            Revisado el {dateLabel(offer.checkedAt)}.
          </p>
          <a href={offer.sourceUrl} target="_blank" rel="noreferrer">
            Consultar fuente oficial <ArrowUpRight size={15} />
            <span className="sr-only">, abre otra pestaña</span>
          </a>
        </div>
      </details>
    </article>
  );
}

export default function PublishedOffers() {
  const [feed, setFeed] = useState<PromotionFeed | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [airline, setAirline] = useState('');
  const [now, setNow] = useState(() => Date.now());

  async function refresh(signal?: AbortSignal) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/travel/promotions', {
        signal,
        cache: 'no-store',
      });
      if (!response.ok)
        throw new Error(
          'No pudimos revisar las ofertas publicadas. Inténtalo de nuevo en un momento.',
        );
      const value = (await response.json()) as PromotionFeed;
      if (!signal?.aborted) {
        setFeed(value);
        setNow(Date.now());
      }
    } catch (failure) {
      if (!signal?.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : 'No pudimos cargar las ofertas.',
        );
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const updateClock = () => setNow(Date.now());
    const onVisibility = () => {
      if (!document.hidden) updateClock();
    };
    window.addEventListener('focus', updateClock);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      controller.abort();
      window.removeEventListener('focus', updateClock);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  useEffect(() => {
    const deadlines = (feed?.offers || [])
      .map((offer) => Date.parse(offer.expiresAt))
      .filter((time) => time > now);
    if (!deadlines.length) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, Math.min(...deadlines) - Date.now()) + 1,
    );
    return () => clearTimeout(timer);
  }, [feed, now]);

  const currentOffers = useMemo(
    () =>
      (feed?.offers || []).filter((offer) => Date.parse(offer.expiresAt) > now),
    [feed, now],
  );
  const origins = [
    ...new Set(currentOffers.map((offer) => offer.origin.city)),
  ].sort();
  const destinations = [
    ...new Set(
      currentOffers
        .filter((offer) => !origin || offer.origin.city === origin)
        .map((offer) => offer.destination.city),
    ),
  ].sort();
  const airlines = [
    ...new Set(currentOffers.map((offer) => offer.airline)),
  ].sort();
  const offers = currentOffers.filter(
    (offer) =>
      (!origin || offer.origin.city === origin) &&
      (!destination || offer.destination.city === destination) &&
      (!airline || offer.airline === airline),
  );

  return (
    <section
      className="published-offers"
      aria-labelledby="published-offers-title"
    >
      <div className="section-heading">
        <div>
          <div className="eyebrow">RUTAS, PRECIOS Y CONDICIONES</div>
          <h2 id="published-offers-title">Explora las tarifas publicadas.</h2>
          <p>
            Tarifas de partida publicadas por aerolíneas, reunidas en
            VoyConPlan.
          </p>
        </div>
        <button
          className="btn outline small"
          onClick={() => void refresh()}
          disabled={busy}
        >
          <RefreshCw size={16} className={busy ? 'spin' : ''} />
          {busy ? 'Revisando…' : 'Actualizar ofertas'}
        </button>
      </div>
      <div
        className="published-offers-filters"
        aria-label="Filtrar ofertas publicadas"
      >
        <label>
          Desde
          <select
            value={origin}
            onChange={(event) => {
              setOrigin(event.target.value);
              setDestination('');
            }}
          >
            <option value="">Todas las salidas</option>
            {origins.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Hasta
          <select
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          >
            <option value="">Todos los destinos publicados</option>
            {destinations.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Aerolínea
          <select
            value={airline}
            onChange={(event) => setAirline(event.target.value)}
          >
            <option value="">Todas las aerolíneas</option>
            {airlines.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <span aria-live="polite">
          <Search size={17} />
          {offers.length}{' '}
          {offers.length === 1 ? 'oferta publicada' : 'ofertas publicadas'}
        </span>
      </div>
      <p className="published-offers-context">
        <Info size={17} />
        Los precios corresponden a las rutas y condiciones de cada tarjeta. Para
        cotizar un viaje concreto, usa «Vuelos para mis fechas» cuando el
        servicio esté disponible.
      </p>
      {error && (
        <p className="notice warning" role="alert">
          {error}
        </p>
      )}
      {busy && !feed && (
        <div className="published-offers-loading" role="status">
          <LoaderCircle className="spin" size={25} />
          <p>Consultando las páginas oficiales…</p>
        </div>
      )}
      <div className="published-offers-grid" aria-live="polite">
        {offers.map((offer) => (
          <PromotionCard key={offer.id} offer={offer} />
        ))}
      </div>
      {!busy && !offers.length && (
        <div className="discovery-empty">
          <Plane size={32} />
          <h3>
            {currentOffers.length
              ? 'No hay publicaciones que coincidan con esos filtros.'
              : 'No hay tarifas publicadas verificables en este momento.'}
          </h3>
          <p>
            {currentOffers.length
              ? 'Prueba otra salida o destino de la lista.'
              : 'Las fuentes pueden cambiar o no estar disponibles. Vuelve a revisar más tarde.'}
          </p>
          {currentOffers.length > 0 && (
            <button
              className="btn outline"
              onClick={() => {
                setOrigin('');
                setDestination('');
                setAirline('');
              }}
            >
              Ver todas las ofertas
            </button>
          )}
        </div>
      )}
      <p className="catalog-source">
        Cobertura limitada a las rutas publicadas por las fuentes consultadas.
        Los códigos identifican la ciudad o el aeropuerto indicado por la
        fuente. Los importes conservan su moneda original y pueden cambiar antes
        de comprar.
        {feed && ' Última revisión: ' + dateLabel(feed.checkedAt) + '.'}
      </p>
      {feed &&
        feed.sources.some((source) => source.status === 'unavailable') && (
          <p className="published-offers-source-note">
            Alguna fuente no respondió con tarifas verificables; sus ofertas no
            se muestran.
          </p>
        )}
    </section>
  );
}
