'use client';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Heart,
  Route,
  ShieldCheck,
  Download,
  LogOut,
  Check,
  MapPin,
  Send,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import Shell, {
  api,
  notify,
  Loading,
  SignIn,
  Modal,
  track,
  logout,
} from './shell';
import Trip from './trip';
import Admin from './admin';
import { Pick, Toggle } from './explore';
import { download } from '@/lib/export';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
export default function Workspace({ path }: { path: string }) {
  return (
    <Shell>
      {path.startsWith('/viajes/') ? (
        <Trip id={path.split('/')[2]} />
      ) : path.startsWith('/admin') ? (
        <Admin />
      ) : path.startsWith('/compartir/') ? (
        <Shared token={path.split('/')[2]} />
      ) : (
        <General path={path} />
      )}
    </Shell>
  );
}
function General({ path }: { path: string }) {
  const [boot, setBoot] = useState<any>(null),
    [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [profile, setProfile] = useState<any>(null),
    [deleteOpen, setDeleteOpen] = useState(false);
  useEffect(() => {
    api('bootstrap')
      .then(async (b) => {
        setBoot(b);
        setProfile({
          ...{
            name: b.user?.name || '',
            budget: 1000,
            pace: 'Equilibrado',
            accommodation: 'Hotel',
            interests: [],
            analytics: false,
            marketing: false,
          },
          ...b.user?.profile,
        });
        if (path === '/viajes' && b.user) {
          if (new URLSearchParams(location.search).get('crear') === '1') {
            const draft = sessionStorage.getItem('vcp-draft');
            if (draft) {
              const t = await api('trips', 'POST', JSON.parse(draft));
              sessionStorage.removeItem('vcp-draft');
              location.replace('/viajes/' + t.id);
              return;
            }
          }
          setRows(await api('trips'));
        } else if (path === '/favoritos' && b.user) {
          const f = await api('favorites');
          setRows(b.destinations.filter((d: any) => f.includes(d.id)));
        } else if (path === '/soporte' && b.user) setRows(await api('support'));
        else if (
          path === '/blog' ||
          path.startsWith('/blog/') ||
          path.startsWith('/noticias')
        )
          setRows(await api('content'));
      })
      .catch((e) => setError(e.message));
    if (path === '/planes') track('pricing_view');
  }, [path]);
  if (error)
    return (
      <div className="empty-state">
        <h2>No pudimos cargar esta sección.</h2>
        <p role="alert">{error}</p>
        <button className="btn" onClick={() => location.reload()}>
          Reintentar
        </button>
      </div>
    );
  if (!boot) return <Loading />;
  if (
    ['/viajes', '/favoritos', '/cuenta', '/soporte'].includes(path) &&
    !boot.user
  )
    return <SignIn returnTo={path} />;
  if (path === '/viajes')
    return (
      <>
        <div className="section-heading">
          <div>
            <div className="eyebrow">TUS PRÓXIMAS HISTORIAS</div>
            <h1 className="page-title">Mis viajes.</h1>
            <p className="subheading">De la primera idea al último recuerdo.</p>
          </div>
          <a className="btn lime" href="/">
            <Plus size={18} />
            Planificar un viaje
          </a>
        </div>
        {rows.length ? (
          <div className="destination-grid">
            {rows.map((t) => {
              const d = boot.destinations.find(
                (d: any) => d.id === t.data.destinationId,
              );
              return (
                <a
                  className="destination-card trip-card"
                  key={t.id}
                  href={'/viajes/' + t.id}
                >
                  <div
                    className="card-art"
                    style={{ backgroundImage: "url('" + d?.image + "')" }}
                  >
                    <span className="pill">{t.data.status}</span>
                  </div>
                  <div className="card-body">
                    <span className="muted">
                      {d?.country} · {t.data.search.type}
                    </span>
                    <h3>{t.data.title}</h3>
                    <p>
                      {t.data.search.date} · {t.data.search.days} días
                    </p>
                    <div className="card-bottom">
                      <span>Continuar mi plan</span>
                      <ArrowUpRight size={22} />
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <Route size={40} />
            <h2>Todo viaje empieza con una idea.</h2>
            <p>
              Encuentra un destino que encaje con tu presupuesto y empieza a
              darle forma.
            </p>
            <a className="btn lime" href="/">
              Descubrir mi próximo viaje <ArrowRight size={18} />
            </a>
          </div>
        )}
      </>
    );
  if (path === '/favoritos')
    return (
      <>
        <div className="section-heading">
          <div>
            <div className="eyebrow">SIN PRISA, PERO CON GANAS</div>
            <h1 className="page-title">Algún día.</h1>
            <p className="subheading">Esos lugares a los que quieres llegar.</p>
          </div>
          <Heart size={28} />
        </div>
        {rows.length ? (
          <div className="destination-grid">
            {rows.map((d) => (
              <article className="destination-card" key={d.id}>
                <div
                  className="card-art"
                  style={{ backgroundImage: "url('" + d.image + "')" }}
                >
                  <button
                    className="favorite saved"
                    aria-label={'Quitar ' + d.name}
                    onClick={async () => {
                      try {
                        await api('favorites', 'DELETE', {
                          destinationId: d.id,
                        });
                        setRows(rows.filter((x) => x.id !== d.id));
                      } catch (e) {
                        notify(e);
                      }
                    }}
                  >
                    <Heart size={18} fill="currentColor" />
                  </button>
                </div>
                <div className="card-body">
                  <span className="muted">{d.country}</span>
                  <h3>{d.name}</h3>
                  <p>{d.description}</p>
                  <a className="text-link space-top" href="/">
                    Ver presupuesto <ArrowRight size={17} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Heart size={35} />
            <h2>Guarda lo que te inspira.</h2>
            <p>Toca el corazón de un destino para encontrarlo aquí.</p>
            <a className="btn lime" href="/">
              Explorar destinos
            </a>
          </div>
        )}
      </>
    );
  if (path === '/planes')
    return (
      <>
        <div className="centered-heading">
          <div className="eyebrow">UN PLAN PARA CADA VIAJERO</div>
          <h1 className="page-title">Tu viaje merece un buen plan.</h1>
          <p>Empieza gratis. Elige más herramientas cuando las necesites.</p>
        </div>
        <div className="pricing-grid">
          {boot.plans.map((p: any, i: number) => (
            <section
              className={'pricing-card ' + (i === 1 ? 'featured' : '')}
              key={p.id}
            >
              {i === 1 && <span className="popular">PARA VIAJAR MÁS</span>}
              <h3>{p.id}</h3>
              <p>
                {i === 0
                  ? 'El primer paso, sin costo.'
                  : i === 1
                    ? 'Más planes, más posibilidades.'
                    : 'Para quienes siempre van un poco más allá.'}
              </p>
              <div className="price">
                {'$' + (p.price / 100).toFixed(2)}
                <small>USD / mes</small>
              </div>
              <ul>
                <li>
                  <Check size={17} />
                  {p.trip_limit} viajes nuevos al mes
                </li>
                <li>
                  <Check size={17} />
                  {p.collaborators} acompañante(s)
                </li>
                {p.features.map((f: string) => (
                  <li key={f}>
                    <Check size={17} />
                    {f}
                  </li>
                ))}
              </ul>
              {i === 0 ? (
                <a className="btn lime" href="/">
                  Empezar gratis <ArrowRight size={17} />
                </a>
              ) : (
                <button className="btn outline" disabled>
                  Suscripción aún no disponible
                </button>
              )}
            </section>
          ))}
        </div>
        <div className="notice">
          <ShieldCheck />
          <p>
            Los precios son los configurados para el lanzamiento. El procesador
            de pagos no está conectado y no se realizan cobros. Las funciones
            que requieren proveedores o automatización siguen pendientes de
            activación.
          </p>
        </div>
        <p className="centered-note">
          Los requisitos críticos de viaje siempre estarán disponibles en Free.
        </p>
      </>
    );
  if (path === '/cuenta')
    return (
      <>
        <div className="section-heading">
          <div>
            <div className="eyebrow">MI ESTILO DE VIAJE</div>
            <h1 className="page-title">
              Hola, {boot.user.name.split(' ')[0]}.
            </h1>
            <p className="subheading">
              {boot.user.email} · Plan {boot.user.plan}
            </p>
          </div>
          <button className="btn outline small" onClick={() => void logout()}>
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
        <form
          className="panel form-stack account-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api('me', 'PATCH', profile);
              toast.success('Perfil guardado.');
            } catch (e) {
              notify(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>Tu perfil reutilizable</h3>
          <div className="form-grid">
            <label>
              Nombre
              <input
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
                required
                maxLength={80}
              />
            </label>
            <label>
              Presupuesto habitual (USD)
              <input
                value={profile.budget}
                min={50}
                max={1000000}
                type="number"
                onChange={(e) =>
                  setProfile({ ...profile, budget: +e.target.value })
                }
              />
            </label>
            <label>
              Ritmo
              <Pick
                label="Ritmo"
                value={profile.pace}
                options={['Relajado', 'Equilibrado', 'Intenso']}
                onChange={(v) => setProfile({ ...profile, pace: v })}
              />
            </label>
            <label>
              Alojamiento
              <Pick
                label="Alojamiento"
                value={profile.accommodation}
                options={['Hotel', 'Apartamento', 'Hostal', 'Resort']}
                onChange={(v) => setProfile({ ...profile, accommodation: v })}
              />
            </label>
          </div>
          <div className="toggle-row">
            <Toggle
              label="Permitir analítica opcional"
              checked={profile.analytics}
              onChange={(v) => {
                setProfile({ ...profile, analytics: v });
                localStorage.setItem(
                  'vcp-consent',
                  v ? 'analytics' : 'necessary',
                );
              }}
            />
            <Toggle
              label="Quiero recibir novedades (cuando se active el correo)"
              checked={profile.marketing}
              onChange={(v) => setProfile({ ...profile, marketing: v })}
            />
          </div>
          <button disabled={busy} className="btn">
            {busy ? 'Guardando…' : 'Guardar perfil'}
          </button>
        </form>
        <div className="panel space-top">
          <h3>Tu privacidad, en tus manos.</h3>
          <p className="subheading">
            Descarga tus datos o elimina tu cuenta y los viajes que te
            pertenecen.
          </p>
          <div className="inline">
            <button
              className="btn outline"
              onClick={async () => {
                try {
                  download(
                    new Blob([JSON.stringify(await api('export'), null, 2)], {
                      type: 'application/json',
                    }),
                    'VoyConPlan-mis-datos.json',
                  );
                } catch (e) {
                  notify(e);
                }
              }}
            >
              <Download size={17} />
              Descargar mis datos
            </button>
            <button className="danger-btn" onClick={() => setDeleteOpen(true)}>
              Eliminar cuenta
            </button>
            {boot.user.role !== 'user' && (
              <a className="btn" href="/admin">
                Abrir administración
              </a>
            )}
          </div>
        </div>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar tu cuenta</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción elimina tu perfil, favoritos, enlaces y viajes
                propios. No se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api('me', 'DELETE', {
                    confirm: new FormData(e.currentTarget).get('confirm'),
                  });
                  await logout();
                } catch (e) {
                  notify(e);
                }
              }}
            >
              <label>
                Escribe ELIMINAR
                <input name="confirm" required pattern="ELIMINAR" />
              </label>
              <button className="btn danger">
                Eliminar mi cuenta y mis viajes
              </button>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  if (path === '/soporte')
    return (
      <>
        <div className="eyebrow">ESTAMOS PARA AYUDARTE</div>
        <h1 className="page-title">¿Cómo podemos ayudarte?</h1>
        <div className="two-col space-top">
          <form
            className="panel form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              setBusy(true);
              try {
                await api('support', 'POST', {
                  title: f.get('title'),
                  message: f.get('message'),
                });
                setRows(await api('support'));
                form.reset();
                toast.success('Tu solicitud quedó registrada.');
              } catch (e) {
                notify(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>Enviar una solicitud</h3>
            <label>
              Asunto
              <input name="title" required maxLength={120} />
            </label>
            <label>
              Mensaje
              <textarea name="message" required maxLength={3000} rows={6} />
            </label>
            <button disabled={busy} className="btn lime">
              <Send size={17} />
              {busy ? 'Guardando…' : 'Registrar solicitud'}
            </button>
            <small>
              No incluyas contraseñas, tarjetas ni números de pasaporte.
            </small>
          </form>
          <section className="panel">
            <h3>Mis solicitudes</h3>
            {rows.length ? (
              rows.map((r) => (
                <div className="expense-row" key={r.id}>
                  <div>
                    <b>{r.data.title}</b>
                    <small>{r.created_at.slice(0, 10)}</small>
                  </div>
                  <span className="pill">{r.data.status}</span>
                </div>
              ))
            ) : (
              <p className="subheading">No tienes solicitudes todavía.</p>
            )}
          </section>
        </div>
      </>
    );
  if (
    path === '/blog' ||
    path.startsWith('/blog/') ||
    path.startsWith('/noticias')
  ) {
    const slug = path.split('/')[2],
      post = rows.find((r) => r.slug === slug);
    return post ? (
      <article className="article">
        <div className="eyebrow">{post.kind}</div>
        <h1 className="page-title">{post.title}</h1>
        <p className="subheading">{post.summary}</p>
        <div className="article-body">
          {post.body.split('\n').map((t: string, i: number) => (
            <p key={i}>{t}</p>
          ))}
        </div>
        <a href="/blog" className="text-link">
          Volver a las guías
        </a>
      </article>
    ) : (
      <>
        <div className="eyebrow">IDEAS PARA EL CAMINO</div>
        <h1 className="page-title">Historias, guías y novedades.</h1>
        {rows.length ? (
          <div className="content-grid">
            {rows.map((r) => (
              <a href={'/blog/' + r.slug} className="panel" key={r.id}>
                <span className="pill">{r.kind}</span>
                <h3>{r.title}</h3>
                <p>{r.summary}</p>
                <span className="text-link">
                  Leer <ArrowRight size={17} />
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Route />
            <h3>Estamos preparando las primeras historias.</h3>
            <p>
              Las publicaciones aparecerán aquí cuando el equipo las publique.
            </p>
          </div>
        )}
      </>
    );
  }
  const legal: Record<string, [string, string[]]> = {
    '/privacidad': [
      'Privacidad y cookies',
      [
        'Versión inicial para revisión jurídica antes del lanzamiento comercial.',
        'VoyConPlan utiliza tu identidad de acceso, perfil y datos de viaje para guardar y organizar planes. No solicita números de pasaporte ni datos personales identificables de menores.',
        'Los datos persistidos incluyen viajes, gastos, preferencias, enlaces de colaboración y solicitudes de soporte. Se aplican permisos por usuario y registros de auditoría para la administración.',
        'La analítica opcional registra eventos permitidos sólo con consentimiento. No se cargan rastreadores publicitarios. Puedes gestionar tu elección desde Mi cuenta. El sitio emplea almacenamiento necesario para mantener preferencias y borradores temporales.',
        'Los enlaces de lectura excluyen códigos de reserva, gastos y notas privadas, y vencen en siete días. Quien tenga acceso al enlace y al sitio puede ver el itinerario compartido.',
        'Puedes descargar tus datos y solicitar la eliminación desde Mi cuenta. La retención administrativa, los responsables legales y los derechos por jurisdicción deben definirse antes de la apertura comercial.',
        'El mapa usa OpenStreetMap y puede enviar tu dirección IP al proveedor de mosaicos al abrirse. Las fotografías se alojan en el sitio. Las contraseñas se guardan mediante hash scrypt y las sesiones se mantienen en cookies protegidas y revocables. El correo no se verifica ni permite recuperación automática en esta versión.',
      ],
    ],
    '/terminos': [
      'Términos de uso',
      [
        'Borrador para revisión jurídica. VoyConPlan está en fase inicial de desarrollo y no presta un servicio de reserva ni vende pasajes en esta versión.',
        'El catálogo inicial contiene precios, tiempos de vuelo y tipos de cambio DEMO. No son ofertas, cotizaciones ni garantías de disponibilidad. No tomes decisiones de compra basándote en ellos.',
        'Los requisitos de entrada, tránsito y salud no se han verificado. Antes de viajar consulta organismos oficiales, consulados y tu transportista. La falta de una advertencia no confirma que el viaje sea admisible.',
        'Los itinerarios combinan bloques orientativos y datos que introduces. Debes comprobar horarios, traslados, reservas y accesibilidad.',
        'Free permite empezar sin costo. Plus y Max muestran precios previstos; los pagos no están activos. No se promete uso ilimitado.',
        'No hay comisiones afiliadas activas ni envíos automáticos en esta versión. Cuando se implementen, se informará en el lugar correspondiente.',
      ],
    ],
  };
  if (legal[path])
    return (
      <article className="article">
        <div className="eyebrow">VOYCONPLAN</div>
        <h1 className="page-title">{legal[path][0]}</h1>
        {legal[path][1].map((p, i) => (
          <p key={i} className={i === 0 ? 'notice-text' : 'article-body'}>
            {p}
          </p>
        ))}
        <a className="btn outline" href="/soporte">
          Contactar con soporte
        </a>
      </article>
    );
  return (
    <div className="empty-state">
      <MapPin />
      <h1 className="page-title">Este camino aún no existe.</h1>
      <a className="btn lime" href="/">
        Volver a explorar
      </a>
    </div>
  );
}
function Shared({ token }: { token: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api('share/' + token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);
  if (error)
    return (
      <div className="empty-state">
        <ShieldCheck />
        <h2>Este enlace ya no está disponible.</h2>
        <p>{error}</p>
      </div>
    );
  if (!data) return <Loading />;
  if (data.kind === 'invite')
    return (
      <div className="empty-state">
        <Heart size={40} />
        <h1 className="page-title">Un viaje se disfruta juntos.</h1>
        <p>
          Te invitaron a colaborar en un viaje. Al aceptar podrás ver y editar
          el plan con tu cuenta.
        </p>
        <button
          disabled={busy}
          className="btn lime"
          onClick={async () => {
            setBusy(true);
            try {
              const b = await api('bootstrap');
              if (!b.user) {
                location.assign(
                  '/entrar?return_to=' +
                    encodeURIComponent('/compartir/' + token),
                );
                return;
              }
              const r = await api('accept', 'POST', { token });
              location.assign('/viajes/' + r.tripId);
            } catch (e) {
              notify(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          Aceptar invitación <ArrowRight size={17} />
        </button>
      </div>
    );
  return (
    <article className="article">
      <div className="eyebrow">UN PLAN COMPARTIDO CONTIGO</div>
      <h1 className="page-title">{data.trip.title}</h1>
      <p className="subheading">
        {data.trip.search.date} · {data.trip.search.days} días · Vista de
        lectura
      </p>
      <div className="notice warning">
        {data.trip.requirements} Plan{' '}
        {data.trip.provenance === 'demo' ? 'DEMO' : 'manual'}.
      </div>
      {data.trip.itinerary.map((d: any) => (
        <section className="panel space-top" key={d.date}>
          <h3>{d.date}</h3>
          {d.items.length ? (
            d.items.map((i: any, n: number) => (
              <div className="expense-row" key={n}>
                <b>{i.time}</b>
                <span>{i.title}</span>
                <small>{i.duration} min</small>
              </div>
            ))
          ) : (
            <p className="muted">Día por planificar.</p>
          )}
        </section>
      ))}
      <p className="notice-text">
        Este enlace vence el {new Date(data.expiresAt).toLocaleDateString('es')}
        . Las reservas y gastos privados están excluidos.
      </p>
    </article>
  );
}
