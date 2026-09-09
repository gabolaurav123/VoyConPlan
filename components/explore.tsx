'use client';
import {
  ArrowUpRight,
  ArrowRight,
  Compass,
  MapPin,
  Wallet,
  Users,
  CalendarDays,
  Check,
  Heart,
  SlidersHorizontal,
  Map,
  LayoutGrid,
  Scale,
  Info,
  Plus,
  Minus,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import Shell, { api, notify, Modal, Loading, track } from './shell';
import {
  defaultSearch,
  origins,
  currencies,
  categories,
  money,
  Search,
  estimate,
  Destination,
} from '@/lib/domain';
import { toast } from '@/lib/toast';
import DestinationMap from './map';
import WebTools from './webmcp';
export function Pick({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((v) => (
          <SelectItem key={v} value={v}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="check-label">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      {label}
    </label>
  );
}
export default function Explore() {
  const [search, setSearch] = useState<Search>(defaultSearch),
    [catalog, setCatalog] = useState<Destination[]>([]),
    [results, setResults] = useState<any[]>([]),
    [user, setUser] = useState<any>(null),
    [favorites, setFavorites] = useState<string[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [advanced, setAdvanced] = useState(false),
    [known, setKnown] = useState(false),
    [selected, setSelected] = useState<any>(null),
    [comparison, setComparison] = useState<string[]>([]),
    [compareOpen, setCompareOpen] = useState(false),
    [view, setView] = useState('grid'),
    [filter, setFilter] = useState('Todos'),
    [hasSearched, setHasSearched] = useState(false),
    [searchRevision, setSearchRevision] = useState(0);
  const creationKey = useRef({ payload: '', key: '' });
  const patch = (p: Partial<Search>) => setSearch((s) => ({ ...s, ...p }));
  useEffect(() => {
    api('bootstrap')
      .then(async (b) => {
        setCatalog(b.destinations);
        setUser(b.user);
        if (b.user) setFavorites(await api('favorites'));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    track('landing_view');
  }, []);
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(
      () => {
        setBusy(true);
        fetch('/api/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(search),
          signal: ctrl.signal,
        })
          .then(async (r) => {
            const v: any = await r.json();
            if (!r.ok) throw new Error(v.error);
            if (ctrl.signal.aborted) return;
            setResults(v.results);
            setError('');
          })
          .catch((e) => {
            if (e.name !== 'AbortError') setError(e.message);
          })
          .finally(() => {
            if (!ctrl.signal.aborted) setBusy(false);
          });
      },
      searchRevision === 0 ? 0 : 450,
    );
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [search, searchRevision]);
  function find(e?: React.SubmitEvent) {
    e?.preventDefault();
    setHasSearched(true);
    setSearchRevision((v) => v + 1);
    track('search_started');
    document
      .getElementById('destinos')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function favorite(dest: string) {
    if (!user) {
      toast('Inicia sesión para guardar tus destinos.', {
        action: {
          label: 'Entrar',
          onClick: () =>
            location.assign('/signin-with-chatgpt?return_to=%2Ffavoritos'),
        },
      });
      return;
    }
    try {
      await api('favorites', favorites.includes(dest) ? 'DELETE' : 'POST', {
        destinationId: dest,
      });
      setFavorites((f) =>
        f.includes(dest) ? f.filter((x) => x !== dest) : [...f, dest],
      );
    } catch (e) {
      notify(e);
    }
  }
  async function makeTrip(d: any) {
    const payload = JSON.stringify({ destinationId: d.id, search });
    if (creationKey.current.payload !== payload)
      creationKey.current = { payload, key: crypto.randomUUID() };
    const creation = {
      destinationId: d.id,
      search,
      requestId: creationKey.current.key,
    };
    if (!user) {
      sessionStorage.setItem('vcp-draft', JSON.stringify(creation));
      location.assign('/signin-with-chatgpt?return_to=%2Fviajes%3Fcrear%3D1');
      return;
    }
    setBusy(true);
    try {
      const t = await api('trips', 'POST', creation);
      track('trip_created');
      location.assign('/viajes/' + t.id);
    } catch (e) {
      notify(e);
    } finally {
      setBusy(false);
    }
  }
  function compare(id: string) {
    setComparison((c) =>
      c.includes(id)
        ? c.filter((x) => x !== id)
        : c.length < 5
          ? [...c, id]
          : c,
    );
    if (comparison.length === 5 && !comparison.includes(id))
      toast('Puedes comparar hasta cinco destinos.');
  }
  const shown = results.filter(
    (d) =>
      filter === 'Todos' ||
      (filter === 'Con margen'
        ? d.level === 'green' || d.level === 'yellow'
        : d.tags.includes(filter)),
  );
  const selectedComps = results.filter((d) => comparison.includes(d.id));
  const viable = results.filter((d) => d.real <= d.budget).length;
  return (
    <Shell>
      <WebTools
        results={results}
        onResults={(s, r) => {
          setSearch(s);
          setResults(r);
          setHasSearched(true);
          setError('');
        }}
      />
      <section className="hero">
        <div>
          <div className="eyebrow">
            <span className="tiny-dot" /> MENOS VUELTAS. MÁS MUNDO.
          </div>
          <h1>
            Tu próximo viaje
            <br />
            empieza con <br />
            <span>lo que tienes.</span>
          </h1>
          <p>
            No necesitas saber adónde. Dinos desde dónde sales y cuánto quieres
            gastar. El plan empieza aquí.
          </p>
          <div className="hero-note">
            <Compass size={18} /> Tu viaje, con plan.
          </div>
        </div>
        <div
          className="hero-visual"
          role="img"
          aria-label="Viajeros explorando un paisaje costero. Imagen editorial generada."
          style={{
            backgroundImage:
              "linear-gradient(0deg,#102a2c90,transparent 65%),url('/images/" +
              (search.type === 'Solo'
                ? 'solo-city.png'
                : search.type === 'En familia'
                  ? 'family-nature.png'
                  : 'couple-coast.png') +
              "')",
          }}
        >
          <div className="visual-label">
            <span>EL MUNDO TE ESTÁ ESPERANDO</span>
            <ArrowUpRight />
          </div>
          <div className="hero-caption">
            <span>
              Un presupuesto.
              <br />
              Muchas posibilidades.
            </span>
            <div className="circle-arrow">
              <ArrowUpRight />
            </div>
          </div>
        </div>
      </section>
      <section className="search-panel">
        <div className="search-heading">
          <h2>¿Hasta dónde puedes viajar con tu presupuesto?</h2>
          <div className="travel-types">
            {['Solo', 'En pareja', 'En familia'].map((x) => (
              <button
                key={x}
                className={search.type === x ? 'selected' : ''}
                aria-pressed={search.type === x}
                onClick={() =>
                  patch({
                    type: x,
                    travelers: x === 'Solo' ? 1 : x === 'En pareja' ? 2 : 4,
                  })
                }
              >
                {x === 'Solo' ? (
                  <Compass size={15} />
                ) : x === 'En pareja' ? (
                  <Heart size={15} />
                ) : (
                  <Users size={15} />
                )}{' '}
                {x}
              </button>
            ))}
          </div>
        </div>
        <form className="quick-form" onSubmit={find}>
          <label>
            <span>
              <MapPin /> Desde dónde sales
            </span>
            <Pick
              value={search.origin}
              onChange={(v) => patch({ origin: v })}
              options={origins}
              label="Ciudad de salida"
            />
          </label>
          <label>
            <span>
              <Wallet /> Presupuesto{' '}
              {search.perPerson ? 'por persona' : 'total'}
            </span>
            <div className="money-input">
              <input
                aria-label="Presupuesto"
                type="number"
                value={search.budget}
                onChange={(e) => patch({ budget: Number(e.target.value) })}
                min="50"
                max="1000000"
                required
              />
              <Pick
                value={search.currency}
                onChange={(v) => patch({ currency: v })}
                options={Object.keys(currencies)}
                label="Moneda"
              />
            </div>
          </label>
          <label>
            <span>
              <CalendarDays /> Fecha de salida
            </span>
            <input
              aria-label="Fecha de salida"
              type="date"
              value={search.date}
              onChange={(e) => patch({ date: e.target.value })}
              required
            />
          </label>
          <button disabled={busy} className="btn lime">
            {busy ? 'Calculando…' : 'Descubrir destinos'}{' '}
            <ArrowRight size={18} />
          </button>
        </form>
        <div className="search-footer">
          <span>
            <Check size={15} /> Empieza sin registrarte
          </span>
          <div className="inline">
            <button onClick={() => setAdvanced(!advanced)}>
              <SlidersHorizontal size={15} /> {search.travelers} viajeros ·{' '}
              {search.days} días · Filtros
            </button>
            <button onClick={() => setKnown(true)}>
              Ya sé adónde quiero ir <ArrowUpRight size={15} />
            </button>
          </div>
        </div>
        {advanced && (
          <div className="advanced">
            <div className="form-grid">
              <label>
                Viajeros
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={search.travelers}
                  onChange={(e) => patch({ travelers: +e.target.value })}
                />
              </label>
              <label>
                Duración en días
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={search.days}
                  onChange={(e) => patch({ days: +e.target.value })}
                />
              </label>
              <label>
                Máximo de horas de vuelo (DEMO)
                <input
                  type="number"
                  min="1"
                  max="48"
                  value={search.maxHours}
                  onChange={(e) => patch({ maxHours: +e.target.value })}
                />
              </label>
            </div>
            <div className="toggle-row">
              <Toggle
                checked={search.includeFlights}
                onChange={(v) => patch({ includeFlights: v })}
                label="Incluir vuelos"
              />
              <Toggle
                checked={search.perPerson}
                onChange={(v) => patch({ perPerson: v })}
                label="Presupuesto por persona"
              />
              <Toggle
                checked={search.insurance}
                onChange={(v) => patch({ insurance: v })}
                label="Seguro estimado"
              />
              <Toggle
                checked={search.internet}
                onChange={(v) => patch({ internet: v })}
                label="Internet / eSIM"
              />
            </div>
            <p className="field-label">¿Qué te gustaría hacer?</p>
            <div className="filter-row">
              {[
                'Playa',
                'Montaña',
                'Ciudad',
                'Naturaleza',
                'Cultura',
                'Gastronomía',
                'Aventura',
              ].map((t) => (
                <button
                  className={
                    'chip ' + (search.interests.includes(t) ? 'selected' : '')
                  }
                  key={t}
                  onClick={() =>
                    patch({
                      interests: search.interests.includes(t)
                        ? search.interests.filter((v) => v !== t)
                        : [...search.interests, t],
                    })
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
      <section id="destinos">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              {hasSearched ? 'TUS POSIBILIDADES' : 'UN POCO DE INSPIRACIÓN'}
            </div>
            <h2>
              {hasSearched
                ? viable +
                  (viable === 1
                    ? ' destino dentro de tu presupuesto.'
                    : ' destinos dentro de tu presupuesto.')
                : 'Un viaje que sí va contigo.'}
            </h2>
          </div>
          <div className="view-switch">
            <button
              className={view === 'grid' ? 'selected' : ''}
              onClick={() => setView('grid')}
              aria-label="Ver tarjetas"
            >
              <LayoutGrid size={17} />
            </button>
            <button
              className={view === 'map' ? 'selected' : ''}
              onClick={() => {
                setView('map');
                setHasSearched(true);
              }}
              aria-label="Ver mapa"
            >
              <Map size={17} />
            </button>
          </div>
        </div>
        <div className="results-tools">
          <div className="filter-row">
            {[
              'Todos',
              'Con margen',
              'Playa',
              'Cultura',
              'Naturaleza',
              'Gastronomía',
            ].map((t) => (
              <button
                className={'chip ' + (filter === t ? 'selected' : '')}
                key={t}
                onClick={() => setFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="muted">
            {search.travelers} personas · {search.days} días · {search.currency}
          </span>
        </div>
        <div className="demo-note">
          <Info size={16} />
          <span>
            <b>DEMO.</b> Costos y tipos de cambio de ejemplo, sin consulta en
            vivo. No son ofertas. Visa y documentación pendientes de verificar.
          </span>
        </div>
        {error && (
          <div role="alert" className="notice warning">
            {error}
            <button
              className="btn small outline"
              onClick={() => location.reload()}
            >
              Reintentar
            </button>
          </div>
        )}
        {loading ? (
          <Loading />
        ) : view === 'map' ? (
          <div className="map-panel">
            <div className="budget-slider">
              <div>
                <b>¿Hasta dónde llego?</b>
                <strong>{money(search.budget, search.currency)}</strong>
              </div>
              <Slider
                aria-label="Presupuesto en el mapa"
                min={100}
                max={8000}
                step={50}
                value={[search.budget]}
                onValueChange={(v) =>
                  patch({ budget: Array.isArray(v) ? v[0] : v })
                }
              />
              <div className="muted">
                <span>100 {search.currency}</span>
                <span>8.000 {search.currency}</span>
              </div>
            </div>
            <DestinationMap destinations={shown} onSelect={setSelected} />
          </div>
        ) : (
          <div className="destination-grid">
            {shown.map((d) => (
              <article className="destination-card" key={d.id}>
                <div
                  className="card-art"
                  style={{ backgroundImage: "url('" + d.image + "')" }}
                >
                  <span className="pill fit">
                    <span className={'status-dot ' + d.level} />
                    {d.score}% de afinidad DEMO
                  </span>
                  <button
                    className={
                      'favorite ' + (favorites.includes(d.id) ? 'saved' : '')
                    }
                    aria-label={
                      (favorites.includes(d.id) ? 'Quitar' : 'Guardar') +
                      ' ' +
                      d.name
                    }
                    onClick={() => favorite(d.id)}
                  >
                    <Heart
                      size={18}
                      fill={favorites.includes(d.id) ? 'currentColor' : 'none'}
                    />
                  </button>
                </div>
                <div className="card-body">
                  <div className="inline between">
                    <span className="muted">{d.country}</span>
                    <span className="tiny-source">DEMO</span>
                  </div>
                  <h3>
                    <button
                      className="text-button"
                      onClick={() => {
                        setSelected(d);
                        track('destination_selected');
                      }}
                    >
                      {d.name}
                    </button>
                  </h3>
                  <p>{d.tags.slice(0, 2).join(' · ')}</p>
                  <div className={'viability ' + d.level}>
                    <span className={'status-dot ' + d.level} />
                    {d.label}
                  </div>
                  <div className="card-bottom">
                    <div>
                      <span className="muted">Total realista estimado</span>
                      <strong>
                        {money(d.real, search.currency)}{' '}
                        <small>/{search.travelers} pers.</small>
                      </strong>
                    </div>
                    <button
                      className="round-btn"
                      aria-label={'Ver ' + d.name}
                      onClick={() => setSelected(d)}
                    >
                      <ArrowUpRight size={23} />
                    </button>
                  </div>
                  <label className="compare-check">
                    <Checkbox
                      checked={comparison.includes(d.id)}
                      onCheckedChange={() => compare(d.id)}
                    />
                    Comparar destino
                  </label>
                </div>
              </article>
            ))}
          </div>
        )}
        {!loading && !shown.length && (
          <div className="empty-state">
            <Compass />
            <h3>Podemos ajustar el plan.</h3>
            <p>
              Amplía el tiempo máximo de vuelo, cambia de intereses o reduce
              unos días el viaje.
            </p>
            <button
              className="btn outline"
              onClick={() => {
                setFilter('Todos');
                patch({ maxHours: 48, interests: [] });
                find();
              }}
            >
              Ampliar búsqueda
            </button>
          </div>
        )}
        <div className="why-plan">
          <div>
            <div className="eyebrow">EL VIAJE COMPLETO, EN UN SOLO LUGAR</div>
            <h2>Descubrir es solo el comienzo.</h2>
            <p>
              Guarda un destino y organiza tus días, preparativos y gastos. A tu
              ritmo, con quien tú quieras.
            </p>
            <a className="btn outline" href="/viajes">
              Ir a mis viajes <ArrowRight size={17} />
            </a>
          </div>
          <div className="benefit-list">
            {[
              [
                '01',
                'Un presupuesto completo',
                'Contempla alojamiento, comida y actividades.',
              ],
              [
                '02',
                'Preparativos a la vista',
                'Documentos y requisitos pendientes, siempre claros.',
              ],
              [
                '03',
                'Un plan que cambia contigo',
                'Edita tus días y lleva el control de los gastos.',
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <b>{t}</b>
                  <p>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {comparison.length > 0 && (
        <div className="compare-bar">
          <Scale size={20} />
          <span>{comparison.length} destinos seleccionados</span>
          <button
            className="btn lime small"
            disabled={comparison.length < 2}
            onClick={() => setCompareOpen(true)}
          >
            Comparar <ArrowRight size={16} />
          </button>
          <button
            aria-label="Vaciar selección"
            onClick={() => setComparison([])}
          >
            <X size={20} />
          </button>
        </div>
      )}
      <Modal
        open={known}
        onClose={() => setKnown(false)}
        title="¿Adónde nos vamos?"
        description="Elige un destino del catálogo para empezar a organizarlo."
      >
        <div className="known-grid">
          {catalog.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setKnown(false);
                setSelected(estimate(d, search));
              }}
            >
              <img src={d.image} alt={d.name} />
              <span>
                {d.name}
                <small>{d.country}</small>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
      </Modal>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name || 'Destino'}
        description={selected?.description}
      >
        {selected && (
          <>
            <img
              className="detail-image"
              src={selected.image}
              alt={selected.name}
            />
            <div className="price-tiers">
              {[
                ['Económico', selected.economic],
                ['Realista', selected.real],
                ['Cómodo', selected.comfortable],
              ].map(([l, v]) => (
                <div key={l}>
                  <span>{l}</span>
                  <b>{money(Number(v), search.currency)}</b>
                </div>
              ))}
            </div>
            <p className="explanation">{selected.explanation}</p>
            <div className="cost-list">
              {categories.map((c, i) => (
                <div key={c}>
                  <span>{c}</span>
                  <b>
                    {i === 5
                      ? 'Sin verificar'
                      : money(selected.amounts[i], search.currency)}
                  </b>
                </div>
              ))}
            </div>
            <div className="notice warning">
              <Info size={18} />
              <p>
                Estimación DEMO para {search.travelers} viajeros. Visa,
                documentación, rutas, horarios y disponibilidad no verificados.
                Afinidad: presupuesto 65%, intereses 25%, duración 10%.
              </p>
            </div>
            <a
              className="source-link"
              href={selected.source}
              target="_blank"
              rel="noreferrer"
            >
              Fotografía: {selected.author} / Unsplash{' '}
              <ArrowUpRight size={13} />
            </a>
            <button
              className="btn lime"
              disabled={busy}
              onClick={() => makeTrip(selected)}
            >
              {busy ? 'Guardando…' : 'Crear mi viaje a ' + selected.name}
              <ArrowRight size={18} />
            </button>
          </>
        )}
      </Modal>
      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Elige el destino que va contigo."
        description="Comparación de costos DEMO. Importes totales para el grupo; no hay tarifas ni requisitos verificados."
      >
        <div className="table-scroll">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tu viaje</TableHead>
                {selectedComps.map((d) => (
                  <TableHead key={d.id}>{d.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ...categories,
                'Total realista',
                'Afinidad',
                'Tiempo de vuelo DEMO',
                'Requisitos',
              ].map((c, i) => (
                <TableRow key={c}>
                  <TableCell>{c}</TableCell>
                  {selectedComps.map((d) => (
                    <TableCell key={d.id}>
                      {i < 9
                        ? i === 5
                          ? 'Sin verificar'
                          : money(d.amounts[i], search.currency)
                        : i === 9
                          ? money(d.real, search.currency)
                          : i === 10
                            ? d.score + '%'
                            : i === 11
                              ? d.flightHours + ' h'
                              : 'Sin verificar'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {selectedComps.length > 0 && (
          <div className="explanation">
            <b>
              {selectedComps[0].name} tiene la mayor afinidad de esta selección.
            </b>
            <p>{selectedComps[0].explanation}</p>
          </div>
        )}
        <p className="muted">
          Clima, escalas, seguridad y condiciones de entrada no consultados. La
          afinidad no es una autorización ni garantía de viaje.
        </p>
      </Modal>
    </Shell>
  );
}
