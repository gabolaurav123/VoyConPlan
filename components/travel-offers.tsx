'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  Globe2,
  Info,
  LoaderCircle,
  Luggage,
  Plane,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Ticket,
  Users,
} from 'lucide-react';
import Shell from './shell';
import AirportInput from './destination-search';
import PublishedOffers from './published-offers';
import type {
  TravelStatus,
  TravelOffer as FlightOffer,
  TravelSearchInput as TravelQuery,
  TravelSearchResult as SearchResponse,
} from '@/lib/travel/types';

function dateFromToday(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function displayDate(value: string) {
  const date = new Date(value.slice(0, 10) + 'T12:00:00Z');
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })
    : value.slice(0, 10);
}
function displayConsultation(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('es-ES', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : 'Sin fecha indicada';
}
function minutes(value: string | null) {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(
    value || '',
  );
  return match
    ? Number(match[1] || 0) * 1440 +
        Number(match[2] || 0) * 60 +
        Number(match[3] || 0)
    : Number.MAX_SAFE_INTEGER;
}
function duration(value: string | null) {
  const total = minutes(value);
  if (total === Number.MAX_SAFE_INTEGER) return 'Duración no indicada';
  return (
    [
      total >= 60 ? Math.floor(total / 60) + ' h' : '',
      total % 60 ? (total % 60) + ' min' : '',
    ]
      .filter(Boolean)
      .join(' ') || '0 min'
  );
}
function fare(amount: string, currency: string) {
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
    }).format(Number(amount));
  } catch {
    return amount + ' ' + currency;
  }
}

function OfferCard({ offer }: { offer: FlightOffer }) {
  return (
    <article className="flight-offer-card">
      <div className="flight-offer-heading">
        <div className="offer-airline-icon">
          <Plane size={21} />
        </div>
        <div>
          <h3>{offer.carrierName}</h3>
          <span>
            {offer.slices.length > 1 ? 'Ida y vuelta' : 'Solo ida'} ·{' '}
            {offer.price.totalPassengers}{' '}
            {offer.price.totalPassengers === 1 ? 'adulto' : 'adultos'}
          </span>
        </div>
        <span
          className={
            'offer-data-kind ' + (offer.mode === 'test' ? 'is-test' : '')
          }
        >
          {offer.mode === 'test' ? 'Precio simulado' : 'Tarifa consultada'}
        </span>
      </div>
      <p className="flight-operating-carriers">
        Operado por {offer.operatingCarriers.join(', ') || offer.carrierName}.
      </p>
      <div className="flight-offer-main">
        <div className="flight-slices">
          {offer.slices.map((slice, index) => {
            const first = slice.segments[0];
            const last = slice.segments[slice.segments.length - 1];
            return (
              <div className="flight-route" key={index}>
                <span className="flight-direction">
                  {index === 0 ? 'IDA' : 'VUELTA'}
                </span>
                <div className="flight-point">
                  <strong>{first?.departureAt.slice(11, 16) || '—'}</strong>
                  <span>{slice.origin}</span>
                  <small>{first ? displayDate(first.departureAt) : ''}</small>
                </div>
                <div className="flight-line">
                  <span>{duration(slice.duration)}</span>
                  <div>
                    <i />
                    <Plane size={14} />
                    <i />
                  </div>
                  <small>
                    {slice.segments.length === 1
                      ? 'Directo'
                      : `${slice.segments.length - 1} ${slice.segments.length === 2 ? 'escala' : 'escalas'}`}
                  </small>
                </div>
                <div className="flight-point flight-arrival">
                  <strong>{last?.arrivalAt.slice(11, 16) || '—'}</strong>
                  <span>{slice.destination}</span>
                  <small>{last ? displayDate(last.arrivalAt) : ''}</small>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flight-price">
          <small>
            Total para{' '}
            {offer.price.totalPassengers === 1
              ? '1 adulto'
              : `los ${offer.price.totalPassengers} adultos`}
          </small>
          <strong>{fare(offer.price.amount, offer.price.currency)}</strong>
          <span>Importe devuelto por {offer.provider}</span>
          <p>
            Consulta informativa.
            <br />
            No se ha reservado este precio.
          </p>
        </div>
      </div>
      <details className="flight-details">
        <summary>
          Ver trayectos y condiciones <ChevronDown size={16} />
        </summary>
        <div>
          {offer.slices.map((slice, index) => (
            <div className="flight-segments" key={index}>
              <h4>
                {index === 0 ? 'Ida' : 'Vuelta'} · {slice.origin} →{' '}
                {slice.destination}
              </h4>
              {slice.segments.map((segment, segmentIndex) => (
                <div className="flight-segment" key={segmentIndex}>
                  <span>
                    <b>
                      {segment.origin} → {segment.destination}
                    </b>
                    <small>
                      {displayDate(segment.departureAt)} ·{' '}
                      {segment.departureAt.slice(11, 16)} →{' '}
                      {displayDate(segment.arrivalAt)} ·{' '}
                      {segment.arrivalAt.slice(11, 16)}
                    </small>
                  </span>
                  <span>
                    {segment.operatingCarrier}
                    <small>
                      Vuelo {segment.flightNumber} ·{' '}
                      {duration(segment.duration)}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div className="flight-conditions">
            <p>
              <Clock3 size={16} /> Los horarios corresponden a la hora local de
              cada aeropuerto.
            </p>
            <p>
              <Luggage size={16} /> Equipaje, cambios, reembolsos y cargos
              adicionales: confirma las condiciones de la tarifa antes de
              comprar.
            </p>
            <p>
              <Info size={16} /> Disponibilidad sujeta a confirmación. Consulta
              realizada: {displayConsultation(offer.consultedAt)}. Vigente como
              máximo hasta {displayConsultation(offer.expiresAt)}.
            </p>
          </div>
        </div>
      </details>
    </article>
  );
}

export default function TravelOffers() {
  const [view, setView] = useState<'published' | 'flights'>('published');
  const [status, setStatus] = useState<TravelStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState(() => dateFromToday(30));
  const [returnDate, setReturnDate] = useState(() => dateFromToday(37));
  const [roundTrip, setRoundTrip] = useState(true);
  const [adults, setAdults] = useState(1);
  const [cabinClass, setCabinClass] =
    useState<TravelQuery['cabinClass']>('economy');
  const [maxConnections, setMaxConnections] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [currency, setCurrency] = useState('');
  const [airline, setAirline] = useState('');
  const [sort, setSort] = useState('price');
  const [clock, setClock] = useState(() => Date.now());
  const activeSearch = useRef<AbortController | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  async function checkStatus(signal?: AbortSignal) {
    setStatusError(false);
    try {
      const result = await fetch('/api/travel/status', {
        signal,
        cache: 'no-store',
      });
      if (!result.ok) throw new Error('Status unavailable');
      const next = (await result.json()) as TravelStatus;
      if (!signal?.aborted) setStatus(next);
    } catch {
      if (!signal?.aborted) setStatusError(true);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void checkStatus(controller.signal);
    const params = new URLSearchParams(location.search);
    if (params.has('destination') || params.has('origin')) setView('flights');
    if (/^[A-Z]{3}$/.test(params.get('destination') || ''))
      setDestination(params.get('destination')!);
    if (/^[A-Z]{3}$/.test(params.get('origin') || ''))
      setOrigin(params.get('origin')!);
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => {
      controller.abort();
      activeSearch.current?.abort();
      clearInterval(timer);
    };
  }, []);

  const unexpiredOffers = (response?.offers || []).filter(
    (offer) => Date.parse(offer.expiresAt) > clock,
  );
  const currencies = [
    ...new Set(unexpiredOffers.map((offer) => offer.price.currency)),
  ].sort();
  const airlines = [
    ...new Set(unexpiredOffers.map((offer) => offer.carrierName)),
  ].sort();
  const offers = useMemo(() => {
    const values = (response?.offers || []).filter(
      (offer) =>
        Date.parse(offer.expiresAt) > clock &&
        (!currency || currency === offer.price.currency) &&
        (!airline || airline === offer.carrierName),
    );
    return values.sort((first, second) => {
      if (sort === 'duration')
        return (
          first.slices.reduce(
            (total, slice) => total + minutes(slice.duration),
            0,
          ) -
          second.slices.reduce(
            (total, slice) => total + minutes(slice.duration),
            0,
          )
        );
      if (sort === 'departure')
        return (first.slices[0]?.segments[0]?.departureAt || '').localeCompare(
          second.slices[0]?.segments[0]?.departureAt || '',
        );
      return (
        first.price.currency.localeCompare(second.price.currency) ||
        Number(first.price.amount) - Number(second.price.amount)
      );
    });
  }, [response, clock, currency, airline, sort]);
  const queryChanged =
    response &&
    (origin !== response.query.origin ||
      destination !== response.query.destination ||
      departureDate !== response.query.departureDate ||
      (roundTrip ? returnDate : undefined) !== response.query.returnDate ||
      adults !== response.query.adults ||
      cabinClass !== response.query.cabinClass ||
      maxConnections !== response.query.maxConnections);

  async function searchFlights(event?: React.SubmitEvent) {
    event?.preventDefault();
    setError('');
    if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) {
      setError(
        'Selecciona un aeropuerto de salida y uno de destino en la lista, o escribe sus códigos de tres letras.',
      );
      return;
    }
    if (origin === destination) {
      setError('El aeropuerto de salida y el de destino deben ser diferentes.');
      return;
    }
    if (
      departureDate < dateFromToday(0) ||
      departureDate > dateFromToday(330) ||
      (roundTrip &&
        (returnDate < departureDate || returnDate > dateFromToday(330)))
    ) {
      setError(
        'Elige fechas entre hoy y los próximos 330 días. El regreso debe ser igual o posterior a la salida.',
      );
      return;
    }
    if (!Number.isInteger(adults) || adults < 1 || adults > 9) {
      setError('Puedes consultar de 1 a 9 adultos por búsqueda.');
      return;
    }
    activeSearch.current?.abort();
    const controller = new AbortController();
    activeSearch.current = controller;
    setBusy(true);
    setResponse(null);
    try {
      const query: TravelQuery = {
        origin,
        destination,
        departureDate,
        ...(roundTrip ? { returnDate } : {}),
        adults,
        cabinClass,
        maxConnections,
      };
      const result = await fetch('/api/travel/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
        signal: controller.signal,
      });
      const data = await result.json();
      if (!result.ok) {
        if (data.code === 'NOT_CONFIGURED') void checkStatus();
        throw new Error(
          data.message ||
            data.error ||
            'No pudimos consultar las tarifas. Vuelve a intentarlo.',
        );
      }
      if (!controller.signal.aborted) {
        setResponse(data as SearchResponse);
        setCurrency('');
        setAirline('');
        setClock(Date.now());
        setTimeout(
          () =>
            resultHeading.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            }),
          0,
        );
      }
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : 'No pudimos consultar las tarifas.',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <Shell>
      <section className="discovery-hero offers-hero">
        <div>
          <div className="eyebrow">
            <Ticket size={16} /> VUELOS Y OFERTAS
          </div>
          <h1>
            Una buena tarifa.
            <br />
            <em>Un gran comienzo.</em>
          </h1>
          <p>
            Explora ofertas de vuelos y revisa sus importes, rutas y condiciones
            sin salir de VoyConPlan.
          </p>
          <div className="discovery-hero-points">
            <span>
              <Check size={16} /> Precios en su moneda original
            </span>
            <span>
              <Check size={16} /> Detalles aquí mismo
            </span>
          </div>
        </div>
        <div className="offers-hero-art">
          <img
            src="/brand/travel-editorial.png"
            alt="Un mapa, una libreta y una mochila frente al mar. Imagen editorial de VoyConPlan."
            width={2172}
            height={724}
          />
          <div>
            <span>EL PLAN EMPIEZA CONTIGO</span>
            <Plane size={26} />
          </div>
        </div>
      </section>

      <div
        className="flight-view-switch"
        aria-label="Tipo de búsqueda de vuelos"
      >
        <button
          type="button"
          aria-pressed={view === 'published'}
          onClick={() => setView('published')}
        >
          <Ticket size={18} />
          Ofertas publicadas
        </button>
        <button
          type="button"
          aria-pressed={view === 'flights'}
          onClick={() => {
            setView('flights');
            void checkStatus();
          }}
        >
          <Search size={18} />
          Vuelos para mis fechas
          {status && !status.available && <small>Pendiente de conexión</small>}
        </button>
      </div>
      {view === 'published' && <PublishedOffers />}
      {view === 'flights' && (
        <>
          <section
            className="flight-search-panel"
            aria-labelledby="flight-search-title"
          >
            <div className="flight-search-title">
              <div>
                <h2 id="flight-search-title">¿Adónde nos vamos?</h2>
                <p>Elige aeropuertos, fechas y cómo quieres volar.</p>
              </div>
              <span
                className={
                  'flight-connection-status ' +
                  (status?.mode === 'live' ? 'is-live' : '')
                }
              >
                <i />
                {!status && !statusError
                  ? 'Comprobando disponibilidad…'
                  : status?.mode === 'live'
                    ? 'Consulta de tarifas en vivo'
                    : status?.mode === 'test'
                      ? 'Modo de prueba · precios simulados'
                      : 'Consulta por fechas no habilitada'}
              </span>
            </div>
            <form onSubmit={searchFlights}>
              <fieldset className="flight-journey-type">
                <legend className="sr-only">Tipo de viaje</legend>
                <label>
                  <input
                    type="radio"
                    name="journey"
                    checked={roundTrip}
                    onChange={() => setRoundTrip(true)}
                  />{' '}
                  Ida y vuelta
                </label>
                <label>
                  <input
                    type="radio"
                    name="journey"
                    checked={!roundTrip}
                    onChange={() => setRoundTrip(false)}
                  />{' '}
                  Solo ida
                </label>
              </fieldset>
              <div className="flight-main-fields">
                <AirportInput
                  label="Desde"
                  value={origin}
                  onChange={setOrigin}
                />
                <AirportInput
                  label="Hasta"
                  value={destination}
                  onChange={setDestination}
                />
                <label className="flight-date-field">
                  <span>
                    <CalendarDays size={16} /> Salida
                  </span>
                  <input
                    aria-label="Fecha de salida"
                    type="date"
                    required
                    min={dateFromToday(0)}
                    max={dateFromToday(330)}
                    value={departureDate}
                    onChange={(event) => {
                      setDepartureDate(event.target.value);
                      if (returnDate < event.target.value)
                        setReturnDate(event.target.value);
                    }}
                  />
                </label>
                <label className="flight-date-field">
                  <span>
                    <CalendarDays size={16} /> Regreso
                  </span>
                  <input
                    aria-label="Fecha de regreso"
                    type="date"
                    required={roundTrip}
                    disabled={!roundTrip}
                    min={departureDate || dateFromToday(0)}
                    max={dateFromToday(330)}
                    value={roundTrip ? returnDate : ''}
                    onChange={(event) => setReturnDate(event.target.value)}
                  />
                </label>
              </div>
              <div className="flight-more-fields">
                <label>
                  <span>
                    <Users size={16} /> Adultos
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={9}
                    step={1}
                    required
                    value={adults}
                    onChange={(event) => setAdults(Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>Cabina</span>
                  <select
                    value={cabinClass}
                    onChange={(event) =>
                      setCabinClass(
                        event.target.value as TravelQuery['cabinClass'],
                      )
                    }
                  >
                    <option value="economy">Económica</option>
                    <option value="premium_economy">Económica premium</option>
                    <option value="business">Ejecutiva</option>
                    <option value="first">Primera</option>
                  </select>
                </label>
                <label>
                  <span>Escalas por trayecto</span>
                  <select
                    value={maxConnections}
                    onChange={(event) =>
                      setMaxConnections(Number(event.target.value))
                    }
                  >
                    <option value={2}>Hasta 2 escalas</option>
                    <option value={1}>Hasta 1 escala</option>
                    <option value={0}>Solo vuelos directos</option>
                  </select>
                </label>
                <button
                  className="btn lime flight-search-button"
                  type="submit"
                  disabled={busy || !status?.available}
                >
                  {busy ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <Search size={18} />
                  )}
                  {busy ? 'Consultando vuelos…' : 'Buscar vuelos'}
                </button>
              </div>
              <p className="flight-form-note">
                Por ahora, búsquedas para adultos. Para viajar con menores,
                confirma las opciones y condiciones con la aerolínea.
              </p>
            </form>
            {statusError && (
              <div className="travel-service-notice" role="status">
                <Info size={20} />
                <div>
                  <strong>No pudimos comprobar la disponibilidad.</strong>
                  <p>Inténtalo de nuevo en un momento.</p>
                </div>
                <button
                  className="btn outline small"
                  onClick={() => void checkStatus()}
                >
                  Reintentar
                </button>
              </div>
            )}
            {status && !status.available && (
              <div className="travel-service-notice" role="status">
                <Compass size={23} />
                <div>
                  <strong>
                    La consulta para tus fechas aún no está habilitada.
                  </strong>
                  <p>
                    Falta activar la conexión de tarifas. Mientras tanto, puedes
                    consultar las ofertas publicadas y sus condiciones aquí
                    mismo.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn outline small"
                  onClick={() => setView('published')}
                >
                  Ver ofertas publicadas <ArrowRight size={16} />
                </button>
              </div>
            )}
            {status?.mode === 'test' && (
              <div className="travel-service-notice test-notice" role="status">
                <Info size={20} />
                <div>
                  <strong>Estás viendo una demostración del buscador.</strong>
                  <p>
                    Los resultados de prueba son simulados y no representan
                    precios, vuelos ni disponibilidad reales.
                  </p>
                </div>
              </div>
            )}
            {error && (
              <div className="notice warning space-top" role="alert">
                <Info size={19} />
                <p>{error}</p>
              </div>
            )}
          </section>

          {response && (
            <section
              className="flight-results"
              aria-labelledby="flight-results-title"
            >
              <div className="section-heading">
                <div>
                  <div className="eyebrow">
                    {response.mode === 'test'
                      ? 'RESULTADOS SIMULADOS'
                      : 'TARIFAS PARA TUS FECHAS'}
                  </div>
                  <h2
                    id="flight-results-title"
                    ref={resultHeading}
                    tabIndex={-1}
                  >
                    {response.query.origin} <ArrowRight size={24} />{' '}
                    {response.query.destination}
                  </h2>
                  <p>
                    {displayDate(response.query.departureDate)}
                    {response.query.returnDate
                      ? ' — ' + displayDate(response.query.returnDate)
                      : ' · solo ida'}{' '}
                    · {response.query.adults}{' '}
                    {response.query.adults === 1 ? 'adulto' : 'adultos'}
                  </p>
                </div>
                <button
                  className="btn outline small"
                  disabled={busy || !status?.available}
                  onClick={() => void searchFlights()}
                >
                  <RefreshCw size={16} />{' '}
                  {queryChanged
                    ? 'Buscar con los cambios'
                    : 'Actualizar consulta'}
                </button>
              </div>
              <div className="offer-freshness">
                <Clock3 size={17} />
                <span>
                  Consultado: {displayConsultation(response.consultedAt)}.
                  {response.cached
                    ? ' Consulta reciente recuperada; su fecha se conserva.'
                    : ''}{' '}
                  Los precios pueden cambiar antes de comprar.
                </span>
              </div>
              {queryChanged && (
                <div className="travel-service-notice">
                  <Info size={18} />
                  <p>
                    Has cambiado la búsqueda. Estos resultados corresponden a
                    las fechas y aeropuertos indicados arriba; vuelve a buscar
                    para aplicar los cambios.
                  </p>
                </div>
              )}
              {unexpiredOffers.length > 0 && (
                <div className="flight-result-filters">
                  <span>
                    <SlidersHorizontal size={17} /> {offers.length}{' '}
                    {offers.length === 1 ? 'opción' : 'opciones'}
                  </span>
                  <label>
                    <span className="sr-only">Moneda de las tarifas</span>
                    <select
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                    >
                      <option value="">Todas las monedas</option>
                      {currencies.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Aerolínea</span>
                    <select
                      value={airline}
                      onChange={(event) => setAirline(event.target.value)}
                    >
                      <option value="">Todas las aerolíneas</option>
                      {airlines.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Ordenar resultados</span>
                    <select
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                    >
                      <option value="price">
                        Menor precio
                        {currencies.length > 1 && !currency
                          ? ' por moneda'
                          : ''}
                      </option>
                      <option value="duration">Menor duración total</option>
                      <option value="departure">Salida más temprana</option>
                    </select>
                  </label>
                </div>
              )}
              {currencies.length > 1 && !currency && (
                <p className="flight-form-note">
                  Los importes se muestran en la moneda original. No convertimos
                  divisas; el orden por precio compara cada moneda por separado.
                </p>
              )}
              <div className="flight-offers-list" aria-live="polite">
                {offers.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} />
                ))}
              </div>
              {offers.length === 0 && (
                <div className="discovery-empty">
                  <Plane size={35} />
                  <h3>
                    {response.offers.length > 0 && unexpiredOffers.length === 0
                      ? 'Esta consulta ha caducado.'
                      : unexpiredOffers.length > 0
                        ? 'Ninguna opción coincide con esos filtros.'
                        : 'No hay tarifas disponibles para esta búsqueda.'}
                  </h3>
                  <p>
                    {response.offers.length > 0 && unexpiredOffers.length === 0
                      ? 'Actualiza la búsqueda para consultar la disponibilidad y los precios de nuevo.'
                      : unexpiredOffers.length > 0
                        ? 'Prueba otra aerolínea o moneda para ver más opciones.'
                        : 'Prueba otras fechas, permite escalas o busca un aeropuerto cercano. La disponibilidad depende de las aerolíneas participantes.'}
                  </p>
                  {unexpiredOffers.length > 0 ? (
                    <button
                      className="btn outline"
                      onClick={() => {
                        setCurrency('');
                        setAirline('');
                      }}
                    >
                      Quitar filtros
                    </button>
                  ) : (
                    <a className="btn outline" href="#flight-search-title">
                      Ajustar mi búsqueda <ArrowUpRight size={16} />
                    </a>
                  )}
                </div>
              )}
              <p className="catalog-source">
                Fuente: {response.provider}.{' '}
                {response.mode === 'test'
                  ? 'Datos de prueba, sin valor comercial.'
                  : 'La consulta no cubre necesariamente todas las aerolíneas ni garantiza el menor precio del mercado.'}{' '}
                Las reservas y los pagos no se realizan en VoyConPlan.
              </p>
            </section>
          )}
        </>
      )}
      <section
        className="fare-principles"
        aria-labelledby="fare-principles-title"
      >
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              UNA OFERTA SE ENTIENDE MEJOR CON CONTEXTO
            </div>
            <h2 id="fare-principles-title">Que el precio tenga sentido.</h2>
          </div>
        </div>
        <div className="fare-principle-grid">
          <article>
            <CalendarDays size={25} />
            <h3>Prueba otras fechas.</h3>
            <p>
              Compara días cercanos con la misma ruta y el mismo número de
              viajeros. Cada búsqueda consulta la disponibilidad para esas
              fechas.
            </p>
          </article>
          <article>
            <Luggage size={25} />
            <h3>Mira lo que incluye.</h3>
            <p>
              Antes de comprar, revisa equipaje, asientos y condiciones de
              cambios. El importe del vuelo no es todo el presupuesto del viaje.
            </p>
          </article>
          <article>
            <ShieldCheck size={25} />
            <h3>Comprueba antes de pagar.</h3>
            <p>
              Confirma con la aerolínea el precio final y los detalles de la
              tarifa. Una consulta no retiene plazas ni congela el importe.
            </p>
          </article>
        </div>
      </section>
      <section className="discovery-faq" aria-labelledby="offers-faq-title">
        <div>
          <div className="eyebrow">
            <CircleHelp size={16} /> SIN LETRA PEQUEÑA
          </div>
          <h2 id="offers-faq-title">
            Lo que conviene
            <br />
            saber al comparar.
          </h2>
        </div>
        <div className="discovery-faq-items">
          <details>
            <summary>¿Los precios se actualizan automáticamente?</summary>
            <p>
              Las ofertas publicadas se revisan al cargar la sección, con una
              caché limitada que conserva la fecha de revisión. En «Vuelos para
              mis fechas», cada búsqueda consulta al proveedor cuando la
              conexión está activa; una consulta reciente puede reutilizarse
              durante 90 segundos. Los precios que caducan se retiran.
            </p>
          </details>
          <details>
            <summary>¿Por qué no veo descuentos ni precios tachados?</summary>
            <p>
              Mostramos las tarifas devueltas para tu búsqueda. Solo tendría
              sentido anunciar una rebaja si pudiéramos verificar el precio
              anterior y sus condiciones. No inventamos porcentajes de
              descuento.
            </p>
          </details>
          <details>
            <summary>¿El importe es por persona o por todo el grupo?</summary>
            <p>
              En «Vuelos para mis fechas», el precio es el total para los
              adultos de la búsqueda. En «Ofertas publicadas», se muestra el
              importe de partida de la aerolínea y sus condiciones, sin
              multiplicarlo por viajeros ni atribuirlo a unas fechas que no
              estén publicadas.
            </p>
          </details>
          <details>
            <summary>¿Puedo reservar aquí?</summary>
            <p>
              Por ahora, VoyConPlan sirve para explorar y comparar. La consulta
              no hace una reserva ni realiza un cobro. Confirma y compra tu
              vuelo con la aerolínea o tu agencia habitual.
            </p>
          </details>
          <details>
            <summary>¿Cómo sé si una tarifa es real?</summary>
            <p>
              Las ofertas publicadas incluyen su fuente oficial y fecha de
              revisión. Son precios de partida, sujetos a condiciones. La
              búsqueda por fechas distingue entre tarifas consultadas en vivo y
              resultados de prueba etiquetados como «Precio simulado».
            </p>
          </details>
        </div>
      </section>
      <section className="discovery-next-step">
        <div>
          <div className="eyebrow">TODAVÍA PUEDES SORPRENDERTE</div>
          <h2>
            ¿Y si el próximo destino
            <br />
            aún no está en tu lista?
          </h2>
          <p>
            Busca ciudades y aeropuertos por región. A veces un buen viaje
            empieza por cambiar de idea.
          </p>
        </div>
        <a className="btn lime" href="/destinos">
          Ver destinos del mundo <Globe2 size={18} />
        </a>
      </section>
    </Shell>
  );
}
