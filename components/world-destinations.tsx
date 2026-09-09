'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Globe2,
  LoaderCircle,
  MapPin,
  Plane,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import Shell from './shell';
import type { DestinationCatalog } from './destination-search';

const formatCount = (count: number) => count.toLocaleString('es-ES');

export default function WorldDestinations() {
  const [catalog, setCatalog] = useState<DestinationCatalog | null>(null);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQuery(params.get('q')?.slice(0, 100) || '');
    setRegion(params.get('region') || '');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timer = setTimeout(
      async () => {
        const params = new URLSearchParams({
          q: query,
          region,
          country,
          page: String(page),
          limit: '18',
        });
        try {
          const response = await fetch('/api/destinations?' + params, {
            signal: controller.signal,
          });
          if (!response.ok)
            throw new Error(
              'El catálogo no está disponible en este momento. Vuelve a intentarlo.',
            );
          const data = (await response.json()) as DestinationCatalog;
          if (!controller.signal.aborted) setCatalog(data);
        } catch (failure) {
          if (!controller.signal.aborted)
            setError(
              failure instanceof Error
                ? failure.message
                : 'No pudimos cargar los destinos.',
            );
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      query ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, region, country, page, attempt]);

  function chooseRegion(next: string) {
    setRegion(next);
    setCountry('');
    setPage(1);
  }
  function movePage(next: number) {
    setPage(next);
    resultHeading.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    resultHeading.current?.focus({ preventScroll: true });
  }

  return (
    <Shell>
      <section className="discovery-hero world-hero">
        <div>
          <div className="eyebrow">
            <Globe2 size={16} /> TU CURIOSIDAD NO TIENE FRONTERAS
          </div>
          <h1>
            Hay mucho mundo.
            <br />
            <em>Encuentra tu lugar.</em>
          </h1>
          <p>
            Explora ciudades y aeropuertos por país o región. Elige dónde
            quieres aterrizar y da el siguiente paso con tus propias fechas.
          </p>
          <a href="#catalogo" className="btn lime">
            Explorar el catálogo <ArrowDown size={17} />
          </a>
        </div>
        <div className="world-illustration" aria-hidden="true">
          <div className="world-orbit orbit-one" />
          <div className="world-orbit orbit-two" />
          <Globe2 strokeWidth={0.65} className="world-globe" />
          <span className="world-stamp stamp-one">
            <MapPin size={15} /> Un nuevo lugar
          </span>
          <span className="world-stamp stamp-two">
            <Plane size={15} /> Una nueva historia
          </span>
          <span className="world-trail">CONTIGO, A DONDE VAYAS.</span>
        </div>
      </section>

      <div className="world-stats" aria-live="polite">
        <div>
          <strong>
            {catalog ? formatCount(catalog.source.airportCount) : '—'}
          </strong>
          <span>aeropuertos en el catálogo</span>
        </div>
        <div>
          <strong>
            {catalog ? formatCount(catalog.source.countryCount) : '—'}
          </strong>
          <span>países y territorios</span>
        </div>
        <div>
          <Compass size={28} />
          <span>
            Una búsqueda.
            <br />
            Muchas posibilidades.
          </span>
        </div>
      </div>

      <section
        id="catalogo"
        className="world-catalog"
        aria-labelledby="catalog-title"
      >
        <div className="section-heading">
          <div>
            <div className="eyebrow">PONLE NOMBRE A TU PRÓXIMO VIAJE</div>
            <h2 id="catalog-title">¿Qué parte del mundo te llama?</h2>
          </div>
          <a className="discovery-text-link" href="/ofertas">
            Ya tengo destino <ArrowUpRight size={17} />
          </a>
        </div>
        <div
          className="world-region-filters"
          role="group"
          aria-label="Filtrar por región"
        >
          <button
            type="button"
            className={!region ? 'is-selected' : ''}
            aria-pressed={!region}
            onClick={() => chooseRegion('')}
          >
            <Globe2 size={16} /> Todo el mundo
          </button>
          {catalog?.facets.regions
            .filter((item) => item.count > 0)
            .map((item) => (
              <button
                key={item.code}
                type="button"
                className={region === item.code ? 'is-selected' : ''}
                aria-pressed={region === item.code}
                onClick={() => chooseRegion(item.code)}
              >
                {item.name}
              </button>
            ))}
        </div>
        <div className="world-search-controls">
          <label className="world-query">
            <span className="sr-only">Buscar ciudad, país o aeropuerto</span>
            <Search size={20} />
            <input
              type="search"
              placeholder="Ciudad, país o código de aeropuerto…"
              value={query}
              maxLength={100}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="world-country">
            <SlidersHorizontal size={17} />
            <span className="sr-only">Filtrar por país</span>
            <select
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los países</option>
              {catalog?.facets.countries
                .filter((item) => !region || item.regions.includes(region))
                .map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="catalog-result-heading">
          <h3 ref={resultHeading} tabIndex={-1}>
            {loading
              ? 'Buscando lugares…'
              : error
                ? 'Volvamos a intentarlo'
                : `${formatCount(catalog?.pagination.total || 0)} aeropuertos para explorar`}
          </h3>
          <span aria-live="polite">
            {loading ? (
              <LoaderCircle size={16} className="spin" />
            ) : catalog && !error ? (
              `Página ${catalog.pagination.page} de ${Math.max(1, catalog.pagination.totalPages)}`
            ) : (
              ''
            )}
          </span>
        </div>
        {error ? (
          <div className="discovery-empty" role="alert">
            <Compass size={34} />
            <h3>El mundo sigue ahí.</h3>
            <p>{error}</p>
            <button
              className="btn"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Volver a cargar
            </button>
          </div>
        ) : (
          <div
            className={'world-airport-grid' + (loading ? ' is-loading' : '')}
            aria-busy={loading}
          >
            {catalog?.destinations.map((destination) => (
              <article className="world-airport-card" key={destination.id}>
                <div className="airport-card-top">
                  <span>{destination.regionName}</span>
                  <b>{destination.iata}</b>
                </div>
                <h3>{destination.name}</h3>
                <p className="airport-country">
                  <MapPin size={15} />
                  {destination.country}
                </p>
                <p className="airport-name">{destination.airport}</p>
                <a
                  href={
                    '/ofertas?destination=' +
                    encodeURIComponent(destination.iata)
                  }
                >
                  Buscar vuelos <ArrowUpRight size={18} />
                  <span className="sr-only">
                    {' '}
                    a {destination.name}, {destination.iata}
                  </span>
                </a>
              </article>
            ))}
            {!loading && catalog?.destinations.length === 0 && (
              <div className="discovery-empty">
                <Search size={34} />
                <h3>Aún no encontramos ese lugar.</h3>
                <p>
                  Prueba con la ciudad más cercana, otro país o un código como
                  MAD. El catálogo incluye aeropuertos con código IATA y
                  servicio regular declarado.
                </p>
                <button
                  className="btn outline"
                  onClick={() => {
                    setQuery('');
                    chooseRegion('');
                  }}
                >
                  Quitar filtros
                </button>
              </div>
            )}
            {loading &&
              !catalog &&
              Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="airport-card-skeleton"
                  aria-hidden="true"
                />
              ))}
          </div>
        )}
        {catalog && !error && catalog.pagination.totalPages > 1 && (
          <nav className="catalog-pagination" aria-label="Páginas del catálogo">
            <button
              className="btn outline small"
              disabled={page <= 1 || loading}
              onClick={() => movePage(page - 1)}
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <span>
              {catalog.pagination.page} / {catalog.pagination.totalPages}
            </span>
            <button
              className="btn outline small"
              disabled={!catalog.pagination.hasNext || loading}
              onClick={() => movePage(page + 1)}
            >
              Siguiente <ChevronRight size={16} />
            </button>
          </nav>
        )}
        {catalog && (
          <p className="catalog-source">
            Catálogo de{' '}
            <a href={catalog.source.url} target="_blank" rel="noreferrer">
              {catalog.source.name} <ArrowUpRight size={12} />
            </a>
            . {catalog.source.coverage} La presencia de un aeropuerto no
            garantiza rutas o tarifas disponibles. Datos consultados el{' '}
            {new Date(catalog.source.downloadedAt).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
            .
          </p>
        )}
      </section>

      <section className="discovery-next-step">
        <div>
          <div className="eyebrow">DE LA IDEA A LAS FECHAS</div>
          <h2>El destino es solo el principio.</h2>
          <p>
            Compara las opciones de vuelo para tu ruta y revisa el importe
            total, las escalas y la vigencia de cada consulta.
          </p>
        </div>
        <a className="btn lime" href="/ofertas">
          Explorar vuelos y ofertas <ArrowRight size={18} />
        </a>
      </section>
      <section
        className="discovery-faq"
        aria-labelledby="destination-faq-title"
      >
        <div>
          <div className="eyebrow">ANTES DE DESPEGAR</div>
          <h2 id="destination-faq-title">
            Un poco de claridad.
            <br />
            Un mejor viaje.
          </h2>
        </div>
        <div className="discovery-faq-items">
          <details>
            <summary>¿Están todos los destinos del mundo?</summary>
            <p>
              Incluimos los aeropuertos de la fuente OurAirports que tienen
              código IATA y servicio regular declarado. Es una cobertura
              internacional amplia; no representa cada pueblo, atracción o ruta
              del mundo. Si no encuentras tu destino, busca una ciudad cercana.
            </p>
          </details>
          <details>
            <summary>¿Puedo volar a cualquier aeropuerto del catálogo?</summary>
            <p>
              El catálogo te ayuda a ubicar un destino. Las rutas disponibles
              dependen de tu origen, las fechas y las aerolíneas que participan
              en la búsqueda. Compruébalo en Vuelos y ofertas.
            </p>
          </details>
          <details>
            <summary>¿Dónde reviso los requisitos de entrada?</summary>
            <p>
              Consulta la web oficial del consulado o la autoridad migratoria
              del destino y confirma con tu aerolínea los documentos de tránsito
              y entrada. Los requisitos dependen de tu nacionalidad, residencia,
              ruta y fechas.
            </p>
          </details>
        </div>
      </section>
    </Shell>
  );
}
