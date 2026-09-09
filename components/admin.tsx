'use client';
import { useEffect, useState, useRef } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  MapPin,
  Ticket,
  Tag,
  Plug,
  Wallet,
  ShieldCheck,
  Settings,
  BarChart3,
  LifeBuoy,
  Plus,
  Search,
  Download,
  Edit3,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, Loading, notify, Modal, SignIn, logout } from './shell';
import { Pick } from './explore';
import { download } from '@/lib/export';
import { toast } from '@/lib/toast';
const sections = [
  ['overview', 'Resumen', LayoutDashboard],
  ['analytics', 'Analítica', BarChart3],
  ['users', 'Usuarios', Users],
  ['destinations', 'Destinos', MapPin],
  ['content', 'Contenido y noticias', FileText],
  ['promotions', 'Promociones', Tag],
  ['coupons', 'Cupones', Ticket],
  ['plans', 'Planes', Wallet],
  ['finance', 'Ingresos', Wallet],
  ['providers', 'Proveedores', Plug],
  ['support', 'Soporte', LifeBuoy],
  ['settings', 'Configuración', Settings],
  ['audit', 'Auditoría', ShieldCheck],
] as const;
const permissions: Record<string, string[]> = {
  super_admin: sections.map((s) => s[0]),
  admin: [
    'overview',
    'users',
    'content',
    'promotions',
    'coupons',
    'support',
    'destinations',
    'providers',
    'audit',
    'settings',
  ],
  marketing: ['overview', 'promotions', 'coupons', 'analytics'],
  content: ['overview', 'content', 'destinations'],
  support: ['overview', 'support'],
  finance: ['overview', 'plans', 'finance'],
  analytics: ['overview', 'analytics'],
  readonly: ['overview'],
};
export default function Admin() {
  const [user, setUser] = useState<any>(undefined),
    [section, setSection] = useState('overview'),
    [data, setData] = useState<any>(null),
    [dataSection, setDataSection] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(''),
    [modal, setModal] = useState(false),
    [editing, setEditing] = useState<any>({}),
    [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  const currentSection = useRef('overview');
  useEffect(() => {
    api('bootstrap')
      .then((b) => setUser(b.user))
      .catch((e) => setError(e.message));
  }, []);
  async function refresh() {
    const target = section;
    if (currentSection.current !== target) return;
    const request = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const result = await api('admin/' + target);
      if (request === requestId.current && currentSection.current === target) {
        setData(result);
        setDataSection(target);
      }
    } catch (e) {
      if (request === requestId.current)
        setError(e instanceof Error ? e.message : 'Error');
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (user && user.role !== 'user') void refresh();
    return () => {
      requestId.current++;
    };
  }, [section, user]);
  if (error && user === undefined)
    return <div className="notice warning">{error}</div>;
  if (user === undefined) return <Loading />;
  if (!user) return <SignIn returnTo="/admin" />;
  if (user.role === 'user')
    return (
      <div className="empty-state">
        <ShieldCheck size={40} />
        <h1 className="page-title">Acceso restringido.</h1>
        <p>
          Tu cuenta no tiene permisos de administración. Inicia sesión con el
          correo autorizado.
        </p>
        <button className="btn outline" onClick={() => void logout('/admin')}>
          Cambiar de cuenta
        </button>
      </div>
    );
  const title = sections.find((s) => s[0] === section)?.[1] || 'Administración',
    editable = ['content', 'promotions', 'coupons', 'settings'].includes(
      section,
    ),
    rows = Array.isArray(data)
      ? data.filter((r) =>
          JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
        )
      : [];
  function edit(r: any = {}) {
    setEditing(
      section === 'content'
        ? { kind: 'Post', status: 'Borrador', ...r }
        : section === 'plans'
          ? r
          : section === 'destinations'
            ? { id: r.id, description: r.data.description, hidden: r.hidden }
            : section === 'users'
              ? r
              : { status: 'Borrador', ...r.data, id: r.id },
    );
    setModal(true);
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('admin/' + section, 'POST', editing);
      setModal(false);
      toast.success('Cambios guardados.');
      await refresh();
    } catch (e) {
      notify(e);
    } finally {
      setBusy(false);
    }
  }
  const columns =
    section === 'content'
      ? ['Título', 'Tipo', 'Estado', 'Actualización', 'Acciones']
      : section === 'users'
        ? ['Usuario', 'Correo', 'Plan', 'Rol', 'Estado', 'Acciones']
        : section === 'providers'
          ? ['Servicio', 'Proveedor', 'Estado', 'Última consulta']
          : section === 'audit'
            ? ['Fecha', 'Actor', 'Acción', 'Entidad']
            : section === 'plans'
              ? [
                  'Plan',
                  'USD / mes',
                  'Viajes / mes',
                  'Colaboradores',
                  'Acciones',
                ]
              : section === 'destinations'
                ? ['Destino', 'País', 'Visibilidad', 'Acciones']
                : ['Título', 'Estado', 'Código', 'Fecha', 'Acciones'];
  return (
    <div className="admin-container">
      <SidebarProvider
        style={{ '--sidebar-width': '230px' } as React.CSSProperties}
      >
        <Sidebar className="admin-sidebar" collapsible="offcanvas">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>VOYCONPLAN · OPERACIONES</SidebarGroupLabel>
              <SidebarMenu>
                {sections
                  .filter((s) => permissions[user.role]?.includes(s[0]))
                  .map(([key, label, Icon]) => (
                    <SidebarMenuItem key={key}>
                      <SidebarMenuButton
                        isActive={section === key}
                        onClick={() => {
                          currentSection.current = key;
                          requestId.current++;
                          setLoading(true);
                          setError('');
                          setModal(false);
                          setSection(key);
                          setQuery('');
                        }}
                      >
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroup>
            <div className="admin-account">
              <b>{user.name}</b>
              <small>{user.role}</small>
            </div>
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="admin-main">
          <div className="admin-heading">
            <div className="inline">
              <SidebarTrigger />
              <div>
                <span className="eyebrow">CENTRO OPERATIVO</span>
                <h1>{title}</h1>
              </div>
            </div>
            <span className="pill">Datos reales del sitio</span>
          </div>
          <div className="admin-tools">
            <div className="search-input">
              <Search size={17} />
              <input
                placeholder="Buscar en esta sección…"
                aria-label="Buscar en la sección"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="inline">
              {Array.isArray(data) && rows.length > 0 && (
                <button
                  className="btn outline small"
                  onClick={() => {
                    const headers = Object.keys(rows[0]);
                    const safe = (v: any) => {
                      let s =
                        typeof v === 'object'
                          ? JSON.stringify(v)
                          : String(v ?? '');
                      if (/^[=+@-]/.test(s)) s = "'" + s;
                      return '"' + s.replaceAll('"', '""') + '"';
                    };
                    const csv = [
                      headers.join(','),
                      ...rows.map((r) =>
                        headers.map((k) => safe(r[k])).join(','),
                      ),
                    ].join('\r\n');
                    download(
                      new Blob(['\ufeff' + csv], {
                        type: 'text/csv;charset=utf-8',
                      }),
                      'VoyConPlan-' + section + '.csv',
                    );
                  }}
                >
                  <Download size={15} />
                  CSV
                </button>
              )}
              {editable && (
                <button className="btn lime small" onClick={() => edit()}>
                  <Plus size={16} />
                  Crear {section === 'content' ? 'contenido' : 'registro'}
                </button>
              )}
            </div>
          </div>
          {loading || (!error && dataSection !== section) ? (
            <Loading />
          ) : error ? (
            <div className="notice warning">
              <p role="alert">{error}</p>
              <button className="btn small" onClick={refresh}>
                Reintentar
              </button>
            </div>
          ) : section === 'overview' ? (
            <>
              <div className="stat-grid">
                {[
                  ['Usuarios', data.users],
                  ['Viajes creados', data.trips],
                  ['Publicaciones', data.posts],
                  ['Eventos consentidos', data.events],
                ].map(([l, n]) => (
                  <div className="stat-card" key={l}>
                    <span>{l}</span>
                    <strong>{n}</strong>
                  </div>
                ))}
              </div>
              <div className="two-col">
                <section className="panel">
                  <h3>Usuarios por plan</h3>
                  {data.usage.map((u: any) => (
                    <div className="expense-row" key={u.plan}>
                      <b>{u.plan}</b>
                      <span>{u.total} usuarios</span>
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <h3>Estado de lanzamiento</h3>
                  <div className="expense-row">
                    <span>Planificación y guardado</span>
                    <span className="pill">Disponible</span>
                  </div>
                  <div className="expense-row">
                    <span>Catálogo de costos</span>
                    <span className="pill amber">DEMO</span>
                  </div>
                  <div className="expense-row">
                    <span>Proveedores configurados</span>
                    <span className="pill amber">{data.providersConfigured ?? data.providersConnected ?? 0}</span>
                  </div>
                  <div className="expense-row">
                    <span>Cobros</span>
                    <span className="pill amber">Sin conectar</span>
                  </div>
                  <p className="notice-text">
                    La configuración no confirma disponibilidad de rutas ni tarifas.
                    No se generan ingresos, costos ni actividad ficticios.
                  </p>
                </section>
              </div>
            </>
          ) : section === 'analytics' ? (
            <>
              <div className="panel">
                <h3>Eventos con consentimiento</h3>
                {data.events.length ? (
                  data.events.map((e: any) => (
                    <div className="analytics-bar" key={e.name}>
                      <span>{e.name}</span>
                      <div>
                        <i
                          style={{
                            width:
                              Math.max(
                                4,
                                (e.total /
                                  Math.max(
                                    ...data.events.map((r: any) => r.total),
                                  )) *
                                  100,
                              ) + '%',
                          }}
                        />
                      </div>
                      <b>{e.total}</b>
                    </div>
                  ))
                ) : (
                  <div className="empty-state compact">
                    <BarChart3 />
                    <p>Aún no se registraron eventos con consentimiento.</p>
                  </div>
                )}
              </div>
              <div className="notice">
                <p>
                  No se recopilan IP completas, contenido de viajes ni datos de
                  pasaporte para analítica. Embudos, cohortes y atribución
                  comercial están pendientes.
                </p>
              </div>
            </>
          ) : section === 'finance' ? (
            <div className="empty-state">
              <Wallet />
              <h2>Facturación sin conectar.</h2>
              <p>
                Los ingresos, MRR, ARR y costos aparecerán cuando exista
                evidencia de transacciones y consumo.
              </p>
            </div>
          ) : (
            <>
              <div className="admin-table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((c) => (
                        <TableHead key={c}>{c}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id || r.name}>
                        {section === 'content' ? (
                          <>
                            <TableCell>
                              <b>{r.title}</b>
                              <small>/{r.slug}</small>
                            </TableCell>
                            <TableCell>{r.kind}</TableCell>
                            <TableCell>
                              <span className="pill">{r.status}</span>
                            </TableCell>
                            <TableCell>{r.updated_at.slice(0, 10)}</TableCell>
                          </>
                        ) : section === 'users' ? (
                          <>
                            <TableCell>{r.name}</TableCell>
                            <TableCell>{r.email}</TableCell>
                            <TableCell>{r.plan}</TableCell>
                            <TableCell>{r.role}</TableCell>
                            <TableCell>
                              {r.suspended ? 'Suspendido' : 'Activo'}
                            </TableCell>
                          </>
                        ) : section === 'providers' ? (
                          <>
                            <TableCell>{r.name}</TableCell>
                            <TableCell>{r.provider}</TableCell>
                            <TableCell>
                              <span className="pill amber">{r.status}</span>
                            </TableCell>
                            <TableCell>
                              {r.lastCheck || 'No realizada'}
                            </TableCell>
                          </>
                        ) : section === 'audit' ? (
                          <>
                            <TableCell>
                              {new Date(r.created_at).toLocaleString('es')}
                            </TableCell>
                            <TableCell>{r.actor}</TableCell>
                            <TableCell>{r.action}</TableCell>
                            <TableCell>{r.entity}</TableCell>
                          </>
                        ) : section === 'plans' ? (
                          <>
                            <TableCell>
                              <b>{r.id}</b>
                            </TableCell>
                            <TableCell>
                              {'$' + (r.price / 100).toFixed(2)}
                            </TableCell>
                            <TableCell>{r.trip_limit}</TableCell>
                            <TableCell>{r.collaborators}</TableCell>
                          </>
                        ) : section === 'destinations' ? (
                          <>
                            <TableCell>{r.data.name}</TableCell>
                            <TableCell>{r.data.country}</TableCell>
                            <TableCell>
                              {r.hidden ? 'Oculto' : 'Visible'}
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>
                              <b>{r.data?.title || r.id}</b>
                              <small>
                                {r.data?.description || r.data?.message}
                              </small>
                            </TableCell>
                            <TableCell>{r.data?.status}</TableCell>
                            <TableCell>{r.data?.code || '—'}</TableCell>
                            <TableCell>{r.created_at?.slice(0, 10)}</TableCell>
                          </>
                        )}
                        {!['providers', 'audit'].includes(section) && (
                          <TableCell>
                            <button
                              className="btn outline small"
                              onClick={() => edit(r)}
                              disabled={
                                section === 'users' &&
                                user.role !== 'super_admin'
                              }
                            >
                              <Edit3 size={14} />
                              Editar
                            </button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!rows.length && (
                  <div className="empty-state compact">
                    <FileText />
                    <h3>
                      {query
                        ? 'No hay coincidencias.'
                        : 'Esta sección está lista para tus datos.'}
                    </h3>
                    <p>
                      {editable
                        ? 'Crea el primer registro para comenzar.'
                        : 'Los registros aparecerán cuando exista actividad.'}
                    </p>
                  </div>
                )}
              </div>
              {['coupons', 'promotions'].includes(section) && (
                <div className="notice">
                  <p>
                    Los registros se guardan para preparar campañas. No se
                    aplican descuentos ni se envían promociones mientras
                    facturación y correo no estén conectados.
                  </p>
                </div>
              )}
            </>
          )}
        </SidebarInset>
      </SidebarProvider>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={(editing.id ? 'Editar ' : 'Crear ') + title.toLowerCase()}
        description="Los cambios se guardan en la base de datos y quedan en auditoría."
      >
        <form onSubmit={save} className="form-stack">
          {section === 'content' ? (
            <>
              <div className="form-grid">
                <label>
                  Tipo
                  <Pick
                    value={editing.kind}
                    options={['Post', 'Noticia', 'Guía', 'FAQ', 'Página']}
                    label="Tipo de contenido"
                    onChange={(v) => setEditing({ ...editing, kind: v })}
                  />
                </label>
                <label>
                  Estado
                  <Pick
                    value={editing.status}
                    options={['Borrador', 'Publicado']}
                    label="Estado editorial"
                    onChange={(v) => setEditing({ ...editing, status: v })}
                  />
                </label>
              </div>
              <label>
                Título
                <input
                  value={editing.title || ''}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                  required
                  maxLength={180}
                />
              </label>
              <label>
                Slug
                <input
                  value={editing.slug || ''}
                  onChange={(e) =>
                    setEditing({ ...editing, slug: e.target.value })
                  }
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                />
              </label>
              <label>
                Resumen
                <textarea
                  rows={2}
                  value={editing.summary || ''}
                  onChange={(e) =>
                    setEditing({ ...editing, summary: e.target.value })
                  }
                  maxLength={400}
                />
              </label>
              <label>
                Contenido de texto
                <textarea
                  rows={9}
                  value={editing.body || ''}
                  onChange={(e) =>
                    setEditing({ ...editing, body: e.target.value })
                  }
                  maxLength={15000}
                />
              </label>
            </>
          ) : section === 'plans' ? (
            <>
              {[
                ['price', 'Precio mensual (centavos USD)'],
                ['trip_limit', 'Viajes nuevos por mes'],
                ['collaborators', 'Colaboradores'],
              ].map(([k, l]) => (
                <label key={k}>
                  {l}
                  <input
                    type="number"
                    min={k === 'price' ? 0 : 1}
                    value={editing[k]}
                    onChange={(e) =>
                      setEditing({ ...editing, [k]: +e.target.value })
                    }
                    required
                  />
                </label>
              ))}
            </>
          ) : section === 'destinations' ? (
            <>
              <label>
                Descripción
                <textarea
                  rows={4}
                  value={editing.description || ''}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                />
              </label>
              <Pick
                label="Visibilidad"
                value={editing.hidden ? 'Oculto' : 'Visible'}
                options={['Visible', 'Oculto']}
                onChange={(v) =>
                  setEditing({ ...editing, hidden: v === 'Oculto' })
                }
              />
            </>
          ) : section === 'users' ? (
            <>
              <p>{editing.email}</p>
              <label>
                Rol
                <Pick
                  label="Rol"
                  value={editing.role}
                  options={[
                    'user',
                    'admin',
                    'marketing',
                    'content',
                    'support',
                    'finance',
                    'analytics',
                    'readonly',
                  ]}
                  onChange={(v) => setEditing({ ...editing, role: v })}
                />
              </label>
              <label>
                Estado
                <Pick
                  label="Estado"
                  value={editing.suspended ? 'Suspendido' : 'Activo'}
                  options={['Activo', 'Suspendido']}
                  onChange={(v) =>
                    setEditing({ ...editing, suspended: v === 'Suspendido' })
                  }
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Título
                <input
                  value={editing.title || ''}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                  required
                  maxLength={120}
                />
              </label>
              <label>
                Descripción
                <textarea
                  rows={4}
                  value={editing.description || editing.message || ''}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  Código
                  <input
                    value={editing.code || ''}
                    onChange={(e) =>
                      setEditing({ ...editing, code: e.target.value })
                    }
                  />
                </label>
                <label>
                  Estado
                  <Pick
                    label="Estado del registro"
                    value={editing.status || 'Borrador'}
                    options={
                      section === 'support'
                        ? ['Nuevo', 'Abierto', 'Resuelto', 'Cerrado']
                        : ['Borrador', 'Activo', 'Pausado']
                    }
                    onChange={(v) => setEditing({ ...editing, status: v })}
                  />
                </label>
              </div>
              {section !== 'support' && (
                <div className="form-grid">
                  <label>
                    Inicio
                    <input
                      type="date"
                      value={editing.start || ''}
                      onChange={(e) =>
                        setEditing({ ...editing, start: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Fin
                    <input
                      type="date"
                      value={editing.end || ''}
                      onChange={(e) =>
                        setEditing({ ...editing, end: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Porcentaje
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editing.value || 0}
                      onChange={(e) =>
                        setEditing({ ...editing, value: +e.target.value })
                      }
                    />
                  </label>
                </div>
              )}
            </>
          )}
          <button disabled={busy} className="btn lime">
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
