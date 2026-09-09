'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Plus,
  Trash2,
  Check,
  Download,
  Share2,
  Heart,
  CalendarDays,
  Wallet,
  ShieldCheck,
  Plane,
  MapPin,
  Clock,
  Copy,
  Link2,
  Users,
  ExternalLink,
  CloudSun,
  Route,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/lib/toast';
import { api, notify, Modal, Loading, SignIn, track } from './shell';
import { Pick, Toggle } from './explore';
import {
  categories,
  money,
  preferenceMatches,
  Destination,
} from '@/lib/domain';
import { essentialRequirements } from '@/lib/providers';
import { exportTripPDF, downloadOffline } from '@/lib/export';
const interestOptions = [
  'Playa',
  'Cultura',
  'Naturaleza',
  'Gastronomía',
  'Aventura',
  'Compras',
  'Vida nocturna',
  'Descanso',
];
export default function Trip({ id }: { id: string }) {
  const [record, setRecord] = useState<any>(null),
    [trip, setTrip] = useState<any>(null),
    [user, setUser] = useState<any>(undefined),
    [destination, setDestination] = useState<Destination | null>(null),
    [error, setError] = useState(''),
    [status, setStatus] = useState('Guardado'),
    [day, setDay] = useState(0),
    [tab, setTab] = useState('itinerario'),
    [itemModal, setItemModal] = useState(false),
    [expenseModal, setExpenseModal] = useState(false),
    [shareModal, setShareModal] = useState(false),
    [link, setLink] = useState<any>(null),
    [links, setLinks] = useState<any[]>([]),
    [sharing, setSharing] = useState(false),
    [newCheck, setNewCheck] = useState(''),
    [prefs, setPrefs] = useState<Record<string, string>>({}),
    [exporting, setExporting] = useState(false);
  const version = useRef(1),
    pending = useRef<any>(null),
    saving = useRef(false),
    halted = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    api('bootstrap')
      .then((b) => {
        setUser(b.user);
        if (b.user)
          return api('trips/' + id).then((r) => {
            setRecord(r);
            setTrip(r.data);
            version.current = r.version;
            setDestination(
              b.destinations.find((d: any) => d.id === r.data.destinationId) ||
                null,
            );
            setPrefs(
              r.members.find((m: any) => m.user_id === b.user.id)
                ?.preferences || {},
            );
          });
      })
      .catch((e) => setError(e.message));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (pending.current || saving.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    addEventListener('beforeunload', before);
    return () => removeEventListener('beforeunload', before);
  }, []);
  async function drain() {
    if (saving.current || halted.current || !pending.current) return;
    saving.current = true;
    while (pending.current && !halted.current) {
      const value = pending.current;
      pending.current = null;
      setStatus('Guardando…');
      try {
        const result = await api('trips/' + id, 'PATCH', {
          version: version.current,
          data: value,
        });
        version.current = result.version;
        setStatus('Guardado');
      } catch (e) {
        pending.current = pending.current || value;
        setStatus('Sin guardar');
        setError(e instanceof Error ? e.message : 'Error al guardar');
        halted.current = true;
        notify(e);
      }
    }
    saving.current = false;
  }
  function change(next: any) {
    setTrip(next);
    pending.current = next;
    setStatus('Cambios pendientes');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(drain, 650);
  }
  const update = (p: any) => change({ ...trip, ...p });
  function updateItem(itemId: string, patch: any) {
    update({
      itinerary: trip.itinerary.map((d: any, i: number) =>
        i === day
          ? {
              ...d,
              items: d.items.map((t: any) =>
                t.id === itemId ? { ...t, ...patch } : t,
              ),
            }
          : d,
      ),
    });
  }
  async function addItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const item = {
      id: crypto.randomUUID(),
      title: String(f.get('title')),
      time: String(f.get('time')),
      duration: Number(f.get('duration')),
      cost: Number(f.get('cost')),
      category: String(f.get('category')),
      notes: String(f.get('notes')),
      done: false,
    };
    const mins = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3);
    if (
      trip.itinerary[day].items.some(
        (x: any) =>
          mins(item.time) < mins(x.time) + x.duration &&
          mins(item.time) + item.duration > mins(x.time),
      )
    ) {
      toast.error('Ese horario se superpone con otra actividad.');
      return;
    }
    update({
      itinerary: trip.itinerary.map((d: any, i: number) =>
        i === day
          ? {
              ...d,
              items: [...d.items, item].sort((a: any, b: any) =>
                a.time.localeCompare(b.time),
              ),
            }
          : d,
      ),
    });
    setItemModal(false);
  }
  function addExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    update({
      expenses: [
        ...trip.expenses,
        {
          id: crypto.randomUUID(),
          title: String(f.get('title')),
          amount: Number(f.get('amount')),
          payer: String(f.get('payer')),
          category: String(f.get('category')),
          date: new Date().toISOString().slice(0, 10),
        },
      ],
    });
    setExpenseModal(false);
  }
  async function newLink(kind = 'read') {
    setSharing(true);
    try {
      const v = await api('trips/' + id + '/share', 'POST', { kind });
      setLink(v);
      setLinks(await api('trips/' + id + '/links'));
      track('share');
    } catch (e) {
      notify(e);
    } finally {
      setSharing(false);
    }
  }
  async function share() {
    setShareModal(true);
    try {
      setLinks(await api('trips/' + id + '/links'));
    } catch (e) {
      notify(e);
    }
  }
  async function savePrefs() {
    try {
      await api('trips/' + id + '/preferences', 'POST', { preferences: prefs });
      setRecord(await api('trips/' + id));
      toast.success('Tus preferencias están guardadas.');
    } catch (e) {
      notify(e);
    }
  }
  if (error && !trip)
    return (
      <div className="empty-state">
        <ShieldCheck />
        <h2>No pudimos abrir el viaje.</h2>
        <p role="alert">{error}</p>
        <a className="btn outline" href="/viajes">
          Volver a mis viajes
        </a>
      </div>
    );
  if (user === null) return <SignIn returnTo={'/viajes/' + id} />;
  if (!trip) return <Loading />;
  const spent = trip.expenses.reduce((a: number, e: any) => a + e.amount, 0),
    budget =
      trip.search.budget * (trip.search.perPerson ? trip.search.travelers : 1),
    planned = trip.planned.reduce((a: number, n: number) => a + n, 0),
    checked = trip.checklist.filter((c: any) => c.done).length;
  const partner = record.members.find((m: any) => m.user_id !== user.id),
    matches = preferenceMatches(prefs, partner?.preferences || {});
  const paidMe = trip.expenses
      .filter((e: any) => e.payer === 'Yo')
      .reduce((a: number, e: any) => a + e.amount, 0),
    paidPartner = trip.expenses
      .filter((e: any) => e.payer === 'Mi pareja')
      .reduce((a: number, e: any) => a + e.amount, 0);
  return (
    <>
      <a className="back-link" href="/viajes">
        <ArrowLeft size={16} /> Mis viajes
      </a>
      <div
        className="trip-cover"
        style={{
          backgroundImage:
            "linear-gradient(90deg,#143735d9,#14373522),url('" +
            destination?.image +
            "')",
        }}
      >
        <div>
          <div className="eyebrow">
            {destination?.country} · {trip.search.type}
          </div>
          <h1>{trip.title}</h1>
          <div className="inline">
            <span>
              <CalendarDays size={16} /> {trip.search.date} · {trip.search.days}{' '}
              días
            </span>
            <span>
              <Users size={16} /> {trip.search.travelers} viajeros
            </span>
          </div>
        </div>
        <span className="pill">Plan en preparación</span>
      </div>
      <div className="trip-toolbar">
        <div className="save-status" aria-live="polite">
          <span
            className={
              'status-dot ' + (status === 'Guardado' ? 'green' : 'orange')
            }
          />
          {status}
        </div>
        <div className="inline">
          <button
            className="btn outline small"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await exportTripPDF(trip, destination, link?.url);
                track('pdf_export');
              } catch (e) {
                notify(e);
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download size={16} />
            {exporting ? 'Preparando…' : 'Descargar PDF'}
          </button>
          {record.isOwner && (
            <button className="btn small" onClick={share}>
              <Share2 size={16} />
              Compartir
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="notice warning" role="alert">
          <p>{error} Los cambios de esta sesión aún no se han guardado.</p>
          <button
            className="btn outline small"
            onClick={() => {
              halted.current = false;
              pending.current = trip;
              setError('');
              drain();
            }}
          >
            Reintentar
          </button>
          <button
            className="btn outline small"
            onClick={() => {
              const blob = new Blob([JSON.stringify(trip, null, 2)], {
                type: 'application/json',
              });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'VoyConPlan-borrador.json';
              a.click();
            }}
          >
            Descargar borrador
          </button>
          <button
            className="btn outline small"
            onClick={() => location.reload()}
          >
            Recargar
          </button>
        </div>
      )}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(String(v))}
        className="trip-tabs"
      >
        <TabsList className="trip-tab-list">
          {[
            ['itinerario', 'Itinerario'],
            ['presupuesto', 'Presupuesto'],
            ['requisitos', 'Requisitos'],
            ['checklist', 'Checklist'],
            ['reservas', 'Reservas'],
            ['pareja', 'Compañeros'],
            ['preferencias', 'Preferencias'],
            ['hoy', 'Hoy'],
          ].map(([v, l]) => (
            <TabsTrigger key={v} value={v}>
              {l}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="itinerario">
          <div className="trip-layout">
            <div>
              <div className="section-heading">
                <div>
                  <div className="eyebrow">A TU RITMO</div>
                  <h2>El plan de cada día.</h2>
                </div>
                <button
                  className="btn lime small"
                  onClick={() => setItemModal(true)}
                >
                  <Plus size={17} /> Añadir actividad
                </button>
              </div>
              <div className="day-picker">
                {trip.itinerary.map((d: any, i: number) => (
                  <button
                    className={day === i ? 'selected' : ''}
                    key={d.date}
                    onClick={() => setDay(i)}
                  >
                    Día {i + 1}
                    <small>
                      {new Intl.DateTimeFormat('es', {
                        day: 'numeric',
                        month: 'short',
                        timeZone: 'UTC',
                      }).format(new Date(d.date + 'T12:00:00Z'))}
                    </small>
                  </button>
                ))}
              </div>
              <div className="timeline">
                {trip.itinerary[day]?.items.map((item: any) => (
                  <article
                    key={item.id}
                    className={'timeline-item ' + (item.done ? 'done' : '')}
                  >
                    <div className="time">
                      {item.time}
                      <small>{item.duration} min</small>
                    </div>
                    <div className="timeline-content">
                      <div className="inline between">
                        <span className="pill">{item.category}</span>
                        <div className="inline">
                          <Checkbox
                            aria-label={'Completar ' + item.title}
                            checked={item.done}
                            onCheckedChange={(v) =>
                              updateItem(item.id, { done: !!v })
                            }
                          />
                          <button
                            aria-label={'Eliminar ' + item.title}
                            onClick={() =>
                              update({
                                itinerary: trip.itinerary.map(
                                  (d: any, i: number) =>
                                    i === day
                                      ? {
                                          ...d,
                                          items: d.items.filter(
                                            (x: any) => x.id !== item.id,
                                          ),
                                        }
                                      : d,
                                ),
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <input
                        aria-label="Nombre de actividad"
                        className="item-title"
                        value={item.title}
                        onChange={(e) =>
                          updateItem(item.id, { title: e.target.value })
                        }
                      />
                      <p>{item.notes}</p>
                      <div className="item-meta">
                        <span>{money(item.cost, trip.search.currency)}</span>
                        <span>Introducido manualmente</span>
                      </div>
                    </div>
                  </article>
                ))}
                {!trip.itinerary[day]?.items.length && (
                  <div className="empty-state compact">
                    <CompassIcon />
                    <h3>Un día por descubrir.</h3>
                    <p>
                      Añade tus lugares y reservas confirmadas. Deja tiempo para
                      traslados y descansos.
                    </p>
                    <button
                      className="btn outline"
                      onClick={() => setItemModal(true)}
                    >
                      Planificar este día
                    </button>
                  </div>
                )}
              </div>
            </div>
            <aside>
              <div className="summary-card">
                <span className="eyebrow">TU VIAJE DE UN VISTAZO</span>
                <h3>{destination?.name}</h3>
                <div className="cost-list">
                  <div>
                    <span>Presupuesto</span>
                    <b>{money(budget, trip.search.currency)}</b>
                  </div>
                  <div>
                    <span>Planificado DEMO</span>
                    <b>{money(planned, trip.search.currency)}</b>
                  </div>
                  <div>
                    <span>Gastado</span>
                    <b>{money(spent, trip.search.currency)}</b>
                  </div>
                </div>
                <Progress value={Math.min(100, (spent / budget) * 100)} />
                <p className="muted">
                  {checked} de {trip.checklist.length} preparativos listos
                </p>
                <button
                  className="text-link"
                  onClick={() => setTab('checklist')}
                >
                  Ver checklist <ArrowRight size={15} />
                </button>
              </div>
              <div className="notice warning">
                <ShieldCheck size={21} />
                <div>
                  <b>Requisitos por verificar</b>
                  <p>
                    Confirma entrada, pasaporte y tránsito antes de reservar.
                  </p>
                  <button
                    className="text-link"
                    onClick={() => {
                      setTab('requisitos');
                      track('requirements_view');
                    }}
                  >
                    Revisar requisitos <ArrowRight size={15} />
                  </button>
                </div>
              </div>
              <a
                className="map-link"
                href={
                  'https://www.openstreetmap.org/?mlat=' +
                  destination?.lat +
                  '&mlon=' +
                  destination?.lon +
                  '#map=13/' +
                  destination?.lat +
                  '/' +
                  destination?.lon
                }
                target="_blank"
                rel="noreferrer"
              >
                <MapPin />
                <div>
                  <b>Explorar el mapa</b>
                  <p>Abre {destination?.name} en OpenStreetMap</p>
                </div>
                <ArrowUpRight />
              </a>
            </aside>
          </div>
          <div className="demo-note">
            <ShieldCheck size={16} />
            El plan inicial es DEMO. No se han verificado horarios, reservas ni
            rutas. Las actividades manuales requieren tu comprobación.
          </div>
        </TabsContent>
        <TabsContent value="presupuesto">
          <div className="section-heading">
            <div>
              <div className="eyebrow">CADA GASTO, EN SU LUGAR</div>
              <h2>Viaja con las cuentas claras.</h2>
            </div>
            <button className="btn lime" onClick={() => setExpenseModal(true)}>
              <Plus size={17} />
              Registrar gasto
            </button>
          </div>
          <div className="stat-grid">
            {[
              ['Presupuesto', budget],
              ['Planificado DEMO', planned],
              ['Gastado', spent],
              ['Disponible', budget - spent],
            ].map(([l, n]) => (
              <div className="stat-card" key={l}>
                <span>{l}</span>
                <strong>{money(Number(n), trip.search.currency)}</strong>
              </div>
            ))}
          </div>
          <div className="two-col">
            <section className="panel">
              <h3>Plan por categoría</h3>
              <p className="muted">
                Edita la estimación con tus costos confirmados. Todos los
                importes en {trip.search.currency}.
              </p>
              <div className="budget-lines">
                {categories.map((c, i) => (
                  <label key={c}>
                    <span>{c}</span>
                    <input
                      type="number"
                      min="0"
                      value={trip.planned[i] || 0}
                      onChange={(e) =>
                        update({
                          planned: trip.planned.map((n: number, k: number) =>
                            i === k ? +e.target.value : n,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <p className="notice-text">
                Documentación y visa empiezan en 0 por falta de datos. No
                significa que sean gratuitas.
              </p>
            </section>
            <section className="panel">
              <h3>Gastos registrados</h3>
              {trip.expenses.length ? (
                trip.expenses.map((e: any) => (
                  <div className="expense-row" key={e.id}>
                    <div>
                      <b>{e.title}</b>
                      <small>
                        {e.category} · {e.payer} · {e.date}
                      </small>
                    </div>
                    <strong>{money(e.amount, trip.search.currency)}</strong>
                    <button
                      aria-label={'Borrar gasto ' + e.title}
                      onClick={() =>
                        update({
                          expenses: trip.expenses.filter(
                            (v: any) => v.id !== e.id,
                          ),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-state compact">
                  <Wallet />
                  <p>Todavía no has registrado gastos.</p>
                </div>
              )}
              {trip.search.type === 'En pareja' && (
                <div className="explanation">
                  <b>Balance entre los dos</b>
                  <p>
                    {paidMe === paidPartner
                      ? 'Los gastos están equilibrados.'
                      : paidMe > paidPartner
                        ? 'Tu pareja te debe '
                        : 'Debes a tu pareja '}
                    {paidMe !== paidPartner &&
                      money(
                        Math.abs(paidMe - paidPartner) / 2,
                        trip.search.currency,
                      )}
                  </p>
                  <small>
                    Reparto 50/50. “Compartido” cuenta como ya dividido.
                  </small>
                </div>
              )}
            </section>
          </div>
        </TabsContent>
        <TabsContent value="requisitos">
          <div className="section-heading">
            <div>
              <div className="eyebrow">PREPARA LO IMPORTANTE</div>
              <h2>Centro de requisitos del viaje.</h2>
            </div>
            <span className="pill">Esenciales · todos los planes</span>
          </div>
          <div className="notice warning">
            <ShieldCheck />
            <div>
              <b>No se han verificado los requisitos de este viaje.</b>
              <p>
                El proveedor de información migratoria todavía no está
                conectado. No uses esta pantalla como autorización para embarcar
                o entrar en un país.
              </p>
            </div>
          </div>
          <div className="form-grid panel">
            {[
              ['passport', 'País de tu pasaporte'],
              ['residence', 'País de residencia'],
              ['transit', 'Países de tránsito o escala'],
            ].map(([k, l]) => (
              <label key={k}>
                {l}
                <input
                  value={trip.preferences[k]}
                  onChange={(e) =>
                    update({
                      preferences: { ...trip.preferences, [k]: e.target.value },
                    })
                  }
                  placeholder={
                    k === 'transit' ? 'Incluye todas las escalas' : 'País'
                  }
                />
              </label>
            ))}
          </div>
          <div className="requirements-grid">
            {essentialRequirements().map((r) => (
              <div className="requirement" key={r.title}>
                <ShieldCheck size={22} />
                <div>
                  <h3>{r.title}</h3>
                  <span className="pill amber">Pendiente de verificación</span>
                  <p>{r.message}</p>
                  <small>
                    Fuente: no consultada · Última comprobación: ninguna
                  </small>
                </div>
              </div>
            ))}
          </div>
          <p className="notice-text">
            La información puede cambiar. Comprueba siempre los requisitos
            oficiales antes de viajar. Los avisos críticos nunca se ocultan
            detrás de un plan de pago.
          </p>
        </TabsContent>
        <TabsContent value="checklist">
          <div className="section-heading">
            <div>
              <div className="eyebrow">UN PENDIENTE MENOS</div>
              <h2>Todo listo para salir.</h2>
            </div>
            <b>
              {checked}/{trip.checklist.length} completados
            </b>
          </div>
          <Progress
            value={
              trip.checklist.length
                ? (checked / trip.checklist.length) * 100
                : 0
            }
          />
          <div className="checklist">
            {trip.checklist.map((c: any) => (
              <div key={c.id}>
                <label>
                  <Checkbox
                    checked={c.done}
                    onCheckedChange={(v) =>
                      update({
                        checklist: trip.checklist.map((x: any) =>
                          x.id === c.id ? { ...x, done: !!v } : x,
                        ),
                      })
                    }
                  />
                  <span className={c.done ? 'crossed' : ''}>{c.title}</span>
                </label>
                <button
                  aria-label={'Eliminar ' + c.title}
                  onClick={() =>
                    update({
                      checklist: trip.checklist.filter(
                        (x: any) => x.id !== c.id,
                      ),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <form
            className="inline"
            onSubmit={(e) => {
              e.preventDefault();
              if (newCheck.trim()) {
                update({
                  checklist: [
                    ...trip.checklist,
                    {
                      id: crypto.randomUUID(),
                      title: newCheck.trim(),
                      done: false,
                    },
                  ],
                });
                setNewCheck('');
              }
            }}
          >
            <input
              aria-label="Nuevo pendiente"
              placeholder="Añade un pendiente personal…"
              value={newCheck}
              onChange={(e) => setNewCheck(e.target.value)}
              maxLength={200}
            />
            <button className="btn">Añadir</button>
          </form>
          <p className="muted space-top">
            Marcar un requisito como listo registra tu confirmación; no equivale
            a una revisión migratoria.
          </p>
        </TabsContent>
        <TabsContent value="reservas">
          <h2>Los detalles para llegar y quedarte.</h2>
          <p className="subheading">
            Guarda aquí tus reservas. Los buscadores en vivo todavía no están
            conectados.
          </p>
          <div className="two-col">
            <section className="panel">
              <h3>
                <Plane size={22} /> Mi vuelo
              </h3>
              <div className="form-grid one">
                {[
                  ['airline', 'Aerolínea'],
                  ['number', 'Número de vuelo'],
                  ['departure', 'Salida (hora local y zona)'],
                  ['arrival', 'Llegada (hora local y zona)'],
                  ['reservation', 'Código de reserva (privado, opcional)'],
                ].map(([k, l]) => (
                  <label key={k}>
                    {l}
                    <input
                      value={trip.flight[k]}
                      onChange={(e) =>
                        update({
                          flight: { ...trip.flight, [k]: e.target.value },
                        })
                      }
                      maxLength={100}
                    />
                  </label>
                ))}
              </div>
              <div className="notice warning">
                <p>
                  Búsqueda de vuelos: proveedor no conectado. No se muestran
                  ofertas inventadas.
                </p>
              </div>
            </section>
            <section className="panel">
              <h3>
                <MapPin size={22} /> Mi alojamiento
              </h3>
              <div className="form-grid one">
                {[
                  ['name', 'Nombre'],
                  ['address', 'Dirección'],
                  ['checkin', 'Check-in (fecha y hora local)'],
                  ['reservation', 'Código de reserva (privado, opcional)'],
                ].map(([k, l]) => (
                  <label key={k}>
                    {l}
                    <input
                      value={trip.hotel[k]}
                      onChange={(e) =>
                        update({
                          hotel: { ...trip.hotel, [k]: e.target.value },
                        })
                      }
                      maxLength={200}
                    />
                  </label>
                ))}
              </div>
              <div className="notice warning">
                <p>Disponibilidad y precios: proveedor no conectado.</p>
              </div>
            </section>
          </div>
        </TabsContent>
        <TabsContent value="pareja">
          <div className="section-heading">
            <div>
              <div className="eyebrow">UN VIAJE PARA COMPARTIR</div>
              <h2>Lo que hace feliz a cada uno.</h2>
            </div>
            {record.isOwner && (
              <button
                className="btn lime"
                onClick={() => {
                  setShareModal(true);
                  newLink('invite');
                }}
              >
                <Users size={17} />
                Invitar a mi pareja
              </button>
            )}
          </div>
          <p className="subheading">
            {partner
              ? 'Planificando con ' + partner.name
              : 'Completa tus gustos. Tu acompañante podrá responder desde su propia cuenta al aceptar la invitación.'}
          </p>
          <div className="two-col">
            <div className="panel">
              <h3>Mis preferencias</h3>
              <div className="preference-list">
                {interestOptions.map((k) => (
                  <div key={k}>
                    <span>{k}</span>
                    <Pick
                      value={prefs[k] || 'Neutral'}
                      options={[
                        'Me gusta',
                        'Neutral',
                        'Evitar',
                        'Imprescindible',
                      ]}
                      label={k}
                      onChange={(v) => setPrefs({ ...prefs, [k]: v })}
                    />
                  </div>
                ))}
              </div>
              <button className="btn" onClick={savePrefs}>
                Guardar mis preferencias
              </button>
            </div>
            <div className="panel">
              <h3>Nuestras coincidencias</h3>
              {partner ? (
                matches.map((m) => (
                  <div className="match-row" key={m.key}>
                    <b>{m.key}</b>
                    <span>{m.status}</span>
                  </div>
                ))
              ) : (
                <div className="empty-state compact">
                  <Heart size={30} />
                  <p>
                    Las coincidencias aparecerán cuando tu acompañante complete
                    sus gustos.
                  </p>
                </div>
              )}
              <p className="notice-text">
                Las coincidencias organizan las respuestas de ambos. Todavía no
                se genera un itinerario mediante IA.
              </p>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="preferencias">
          <h2>Un viaje a tu medida.</h2>
          <div className="form-grid panel">
            <label>
              Nombre del viaje
              <input
                value={trip.title}
                onChange={(e) => update({ title: e.target.value })}
                maxLength={120}
              />
            </label>
            {[
              ['pace', 'Ritmo', ['Relajado', 'Equilibrado', 'Intenso']],
              [
                'accommodation',
                'Alojamiento',
                ['Hotel', 'Apartamento', 'Hostal', 'Resort'],
              ],
              [
                'occasion',
                'Ocasión',
                [
                  'Vacaciones',
                  'Aniversario',
                  'Luna de miel',
                  'Cumpleaños',
                  'Escapada',
                  'Celebración',
                ],
              ],
            ].map(([k, l, options]) => (
              <label key={String(k)}>
                {l}
                <Pick
                  label={String(l)}
                  value={trip.preferences[String(k)]}
                  options={options as string[]}
                  onChange={(v) =>
                    update({
                      preferences: { ...trip.preferences, [String(k)]: v },
                    })
                  }
                />
              </label>
            ))}
            {[
              ['diet', 'Preferencias alimentarias'],
              ['mobility', 'Necesidades de movilidad'],
              ...(trip.search.type === 'En familia'
                ? [
                    [
                      'childrenAges',
                      'Edades aproximadas de niños (sin nombres)',
                    ],
                  ]
                : []),
            ].map(([k, l]) => (
              <label key={k}>
                {l}
                <input
                  value={trip.preferences[k]}
                  onChange={(e) =>
                    update({
                      preferences: { ...trip.preferences, [k]: e.target.value },
                    })
                  }
                  maxLength={150}
                />
              </label>
            ))}
          </div>
          <div className="panel">
            <h3>Copia para viajar sin conexión</h3>
            <p className="subheading">
              Descarga una copia HTML con el itinerario y checklist. No incluye
              códigos de reserva ni documentos privados.
            </p>
            <button
              className="btn outline"
              onClick={() => downloadOffline(trip)}
            >
              <Download size={17} />
              Descargar copia de lectura
            </button>
          </div>
        </TabsContent>
        <TabsContent value="hoy">
          <h2>Tu viaje, día a día.</h2>
          <p className="subheading">
            Fecha en {destination?.name}:{' '}
            {new Intl.DateTimeFormat('es', {
              dateStyle: 'long',
              timeZone: destination?.timezone || 'UTC',
            }).format(new Date())}
          </p>
          <div className="notice">
            <CloudSun />
            <p>
              Clima no consultado. No hay pronóstico ni replanificación
              automática activos.
            </p>
          </div>
          {(() => {
            const today = new Intl.DateTimeFormat('en-CA', {
              timeZone: destination?.timezone || 'UTC',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(new Date());
            const d = trip.itinerary.find((v: any) => v.date === today);
            return d ? (
              <div className="panel">
                <h3>Actividades de hoy</h3>
                {d.items.map((i: any) => (
                  <div className="expense-row" key={i.id}>
                    <b>{i.time}</b>
                    <span>{i.title}</span>
                    <span>{i.duration} min</span>
                  </div>
                ))}
                {!d.items.length && <p>Aún no hay actividades para hoy.</p>}
              </div>
            ) : (
              <div className="empty-state">
                <CalendarDays />
                <h3>Tu viaje comienza el {trip.search.date}.</h3>
                <p>Mientras llega el día, puedes completar los preparativos.</p>
                <button
                  className="btn outline"
                  onClick={() => setTab('checklist')}
                >
                  Revisar checklist
                </button>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
      <Modal
        open={itemModal}
        onClose={() => setItemModal(false)}
        title={'Añadir al día ' + (day + 1)}
        description="Usa información confirmada. Incluye traslados entre actividades."
      >
        <form onSubmit={addItem} className="form-stack">
          <label>
            Actividad o lugar
            <input
              name="title"
              required
              maxLength={150}
              placeholder="Ej. Paseo por el centro"
            />
          </label>
          <div className="form-grid">
            <label>
              Hora local
              <input name="time" type="time" defaultValue="10:00" required />
            </label>
            <label>
              Duración (minutos)
              <input
                name="duration"
                type="number"
                defaultValue={60}
                min={5}
                max={720}
                required
              />
            </label>
            <label>
              Costo ({trip.search.currency})
              <input
                name="cost"
                type="number"
                step=".01"
                min={0}
                defaultValue={0}
                required
              />
            </label>
          </div>
          <label>
            Categoría
            <input name="category" defaultValue="Actividad" maxLength={60} />
          </label>
          <label>
            Notas, dirección y traslado
            <textarea name="notes" maxLength={1000} rows={3} />
          </label>
          <button className="btn lime">Añadir actividad</button>
        </form>
      </Modal>
      <Modal
        open={expenseModal}
        onClose={() => setExpenseModal(false)}
        title="Registrar un gasto"
        description={
          'Todos los importes de este viaje se guardan en ' +
          trip.search.currency +
          '.'
        }
      >
        <form className="form-stack" onSubmit={addExpense}>
          <label>
            Concepto
            <input name="title" required maxLength={100} />
          </label>
          <label>
            Importe ({trip.search.currency})
            <input
              name="amount"
              type="number"
              step=".01"
              min=".01"
              max="1000000"
              required
            />
          </label>
          <label>
            Categoría
            <input name="category" defaultValue="Comida" required />
          </label>
          <fieldset className="radio-field">
            <legend>¿Quién pagó?</legend>
            <RadioGroup name="payer" defaultValue="Yo" className="inline">
              {['Yo', 'Mi pareja', 'Compartido'].map((p, i) => (
                <label key={p}>
                  <RadioGroupItem value={p} />
                  {p}
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          <button className="btn lime">Guardar gasto</button>
        </form>
      </Modal>
      <Modal
        open={shareModal}
        onClose={() => setShareModal(false)}
        title="Comparte el plan, a tu manera."
        description="Los enlaces vencen en 7 días y puedes revocarlos. Quien tenga un enlace de lectura podrá ver el itinerario, sin tus reservas ni gastos privados."
      >
        <div className="inline">
          <button
            disabled={sharing}
            className="btn lime"
            onClick={() => newLink('read')}
          >
            <Link2 size={17} />
            Crear enlace de lectura
          </button>
          <button
            disabled={sharing}
            className="btn outline"
            onClick={() => newLink('invite')}
          >
            <Users size={17} />
            Invitar acompañante
          </button>
        </div>
        {link && (
          <div className="share-result">
            <b>
              {link.kind === 'invite'
                ? 'Invitación personal (un uso)'
                : 'Enlace de lectura'}
            </b>
            <input aria-label="Enlace generado" readOnly value={link.url} />
            <div className="inline">
              <button
                className="btn small outline"
                onClick={() =>
                  navigator.clipboard
                    .writeText(link.url)
                    .then(() => toast.success('Enlace copiado.'))
                    .catch(notify)
                }
              >
                <Copy size={15} />
                Copiar
              </button>
              <a
                className="btn small"
                target="_blank"
                rel="noreferrer"
                href={
                  'https://wa.me/?text=' +
                  encodeURIComponent(
                    'Nuestro viaje con VoyConPlan: ' + link.url,
                  )
                }
              >
                Abrir WhatsApp <ArrowUpRightIcon />
              </a>
            </div>
            <small>
              Vence: {new Date(link.expiresAt).toLocaleDateString('es')}
            </small>
            <p className="notice-text">
              El sitio está publicado de forma privada. El destinatario necesita
              acceso al sitio para abrirlo.
            </p>
          </div>
        )}
        <div className="link-list">
          {links.map((l) => (
            <div className="expense-row" key={l.id}>
              <span>
                {l.kind === 'invite' ? 'Invitación' : 'Lectura'} ·{' '}
                {l.revoked
                  ? 'Revocado'
                  : 'Vence ' + new Date(l.expires_at).toLocaleDateString('es')}
              </span>
              {!l.revoked && (
                <button
                  className="text-link"
                  onClick={async () => {
                    try {
                      await api('trips/' + id + '/links', 'POST', { id: l.id });
                      setLinks(await api('trips/' + id + '/links'));
                      if (link?.id === l.id) setLink(null);
                    } catch (e) {
                      notify(e);
                    }
                  }}
                >
                  Revocar
                </button>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
function CompassIcon() {
  return <Route size={30} />;
}
function ArrowUpRightIcon() {
  return <ExternalLink size={15} />;
}
