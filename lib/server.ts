import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { demoDestinations } from './domain';
export const runtime = env as unknown as {
  DB: D1Database;
  ADMIN_EMAILS?: string;
  APP_ORIGIN?: string;
  MEDIA?: R2Bucket;
  [key: string]: unknown;
};
export const db = () => runtime.DB;
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export async function hash(s: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(s),
  );
  return [...new Uint8Array(bytes)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
let ready = false;
export async function initialize() {
  if (ready) return;
  await db().batch([
    ...demoDestinations.map((d) =>
      db()
        .prepare(
          'INSERT OR IGNORE INTO destinations (id,data,hidden) VALUES (?,?,0)',
        )
        .bind(d.id, JSON.stringify(d)),
    ),
    ...[
      [
        'Free',
        0,
        2,
        1,
        [
          'Descubrimiento',
          'Itinerario',
          'Requisitos esenciales',
          'Presupuesto',
          'PDF con marca',
          'Compartir',
        ],
      ],
      [
        'Plus',
        299,
        10,
        3,
        [
          'Todo Free',
          'Comparación',
          'Gastos compartidos',
          'Historial: pendiente',
          'Alertas al conectar proveedor',
        ],
      ],
      [
        'Max',
        499,
        30,
        8,
        [
          'Todo Plus',
          'Más viajes',
          'Planificación de varios destinos: pendiente',
          'Asistencia automática: pendiente',
        ],
      ],
    ].map((p: any) =>
      db()
        .prepare(
          'INSERT OR IGNORE INTO plans (id,price,trip_limit,collaborators,features) VALUES (?,?,?,?,?)',
        )
        .bind(p[0], p[1], p[2], p[3], JSON.stringify(p[4])),
    ),
  ]);
  ready = true;
}
export async function currentUser(required = false) {
  const auth = await getChatGPTUser();
  if (!auth) {
    if (required)
      throw new ApiError(
        401,
        'Inicia sesión para guardar y sincronizar tus viajes.',
      );
    return null;
  }
  await db()
    .prepare(
      'INSERT INTO users (id,email,name,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email',
    )
    .bind(auth.userId, auth.email, auth.displayName, now())
    .run();
  const user: any = await db()
    .prepare('SELECT * FROM users WHERE id=?')
    .bind(auth.userId)
    .first();
  if (user.suspended)
    throw new ApiError(
      403,
      'Esta cuenta está suspendida. Contacta con soporte.',
    );
  const superAdmin = String(runtime.ADMIN_EMAILS || '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .includes(auth.email.toLowerCase());
  return {
    ...user,
    role: superAdmin ? 'super_admin' : user.role,
    profile: JSON.parse(user.profile),
  };
}
export const permissions: Record<string, string[]> = {
  super_admin: ['*'],
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
export function permit(user: any, p: string) {
  if (
    !user ||
    !(
      permissions[user.role]?.includes('*') ||
      permissions[user.role]?.includes(p)
    )
  )
    throw new ApiError(403, 'No tienes permiso para esta sección.');
}
export async function log(user: any, action: string, entity: string) {
  await db()
    .prepare(
      'INSERT INTO audit_log (id,actor,action,entity,created_at) VALUES (?,?,?,?,?)',
    )
    .bind(id(), user.id, action, entity, now())
    .run();
}
export async function getTrip(tripId: string, user: any, ownerOnly = false) {
  const row: any = await db()
    .prepare(
      ownerOnly
        ? 'SELECT * FROM trips WHERE id=? AND owner_id=?'
        : 'SELECT * FROM trips WHERE id=? AND (owner_id=? OR EXISTS(SELECT 1 FROM members WHERE trip_id=trips.id AND user_id=?))',
    )
    .bind(...(ownerOnly ? [tripId, user.id] : [tripId, user.id, user.id]))
    .first();
  if (!row)
    throw new ApiError(404, 'No encontramos este viaje o no tienes acceso.');
  return { ...row, data: JSON.parse(row.data) };
}
export async function rateLimit(req: Request) {
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  const identity = await hash(
    (req.headers.get('oai-authenticated-user-id') || ip) +
      ':' +
      Math.floor(Date.now() / 60000),
  );
  const row: any = await db()
    .prepare(
      'INSERT INTO rate_limits(id,count,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count',
    )
    .bind(identity, Date.now() + 120000)
    .first();
  if (row.count > 150)
    throw new ApiError(
      429,
      'Has realizado muchas solicitudes. Espera un minuto.',
    );
  if (Math.random() < 0.02)
    await db()
      .prepare('DELETE FROM rate_limits WHERE expires<?')
      .bind(Date.now())
      .run();
}
export async function body(req: Request) {
  const origin = req.headers.get('origin'),
    expected = runtime.APP_ORIGIN || new URL(req.url).origin;
  if (!origin || origin !== expected)
    throw new ApiError(403, 'Origen de la solicitud no permitido.');
  if (!req.headers.get('content-type')?.startsWith('application/json'))
    throw new ApiError(415, 'Se requiere JSON.');
  const raw = await req.text();
  if (raw.length > 150000)
    throw new ApiError(413, 'El contenido es demasiado grande.');
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, 'JSON inválido.');
  }
}
