import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';

export interface AuthStatement {
  bind(...values: unknown[]): AuthStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface AuthDatabase {
  prepare(sql: string): AuthStatement;
  batch(statements: AuthStatement[]): Promise<unknown>;
}
export interface AuthEnvironment {
  APP_ORIGIN?: string;
  ADMIN_EMAILS?: string;
  ADMIN_SETUP_TOKEN?: string;
  NODE_ENV?: string;
}
export interface SessionUser {
  userId: string;
  displayName: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
}
const SESSION_SECONDS = 14 * 24 * 60 * 60;
const MAX_BODY_BYTES = 12_000;
const HASH_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, HASH_OPTIONS, (error, result) =>
      error ? reject(error) : resolve(result),
    );
  });
export function validatePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128)
    throw new AuthError(
      400,
      'La contraseña debe tener entre 12 y 128 caracteres.',
    );
  return value;
}
export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(16);
  return `scrypt$v1$${salt.toString('hex')}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  if (typeof password !== 'string' || password.length > 128) return false;
  const parts = /^scrypt\$v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded);
  // An absent account incurs the same bounded password derivation.
  const salt = Buffer.from(
    parts?.[1] || '00000000000000000000000000000000',
    'hex',
  );
  const expected = Buffer.from(parts?.[2] || '0'.repeat(128), 'hex');
  const result = await derive(password, salt);
  return timingSafeEqual(result, expected) && !!parts;
}
export function safeReturnPath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\r\n]/.test(value)
  )
    return '/viajes';
  try {
    const url = new URL(value, 'https://voyconplan.local');
    if (
      url.origin !== 'https://voyconplan.local' ||
      /^\/(api\/auth|entrar|crear-cuenta|configurar-admin)(\/|$)/.test(
        url.pathname,
      )
    )
      return '/viajes';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/viajes';
  }
}
function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string')
    throw new AuthError(400, 'Escribe un correo válido.');
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(
      email,
    )
  )
    throw new AuthError(400, 'Escribe un correo válido.');
  return email;
}
function normalizeName(value: unknown): string {
  if (typeof value !== 'string') throw new AuthError(400, 'Escribe tu nombre.');
  const name = value.trim();
  if (name.length < 2 || name.length > 100 || /[\x00-\x1f\x7f]/.test(name))
    throw new AuthError(400, 'El nombre debe tener entre 2 y 100 caracteres.');
  return name;
}
function json(data: unknown, status = 200, cookie?: string): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(JSON.stringify(data), { status, headers });
}
export function createAuthService({
  db,
  env,
  clock = () => Date.now(),
}: {
  db: AuthDatabase;
  env: AuthEnvironment;
  clock?: () => number;
}) {
  const secure = env.NODE_ENV === 'production';
  const cookieName = secure ? '__Host-vcp_session' : 'vcp_session';
  const reservedEmails = (env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const setupConfigured =
    !!env.ADMIN_SETUP_TOKEN &&
    /^[A-Za-z0-9_-]{43,}$/.test(env.ADMIN_SETUP_TOKEN) &&
    reservedEmails.length > 0;
  const statement = (sql: string, ...params: unknown[]) =>
    db.prepare(sql).bind(...params);
  function cookie(token: string, seconds = SESSION_SECONDS) {
    return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}; Expires=${new Date(clock() + seconds * 1000).toUTCString()}${secure ? '; Secure' : ''}`;
  }
  function tokenFromHeaders(headers: Headers): string | null {
    const tokens = (headers.get('cookie') || '')
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.startsWith(cookieName + '='));
    if (tokens.length !== 1) return null;
    const token = tokens[0].slice(cookieName.length + 1);
    return /^[a-f0-9]{64}$/.test(token) ? token : null;
  }
  async function session(headers: Headers): Promise<SessionUser | null> {
    const token = tokenFromHeaders(headers);
    if (!token) return null;
    const user = await statement(
      `SELECT u.id, u.name, u.email, a.email_verified FROM auth_sessions s JOIN users u ON u.id=s.user_id JOIN auth_accounts a ON a.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.suspended=0`,
      sha256(token),
      clock(),
    ).first<{
      id: string;
      name: string;
      email: string;
      email_verified: number;
    }>();
    if (!user) return null;
    return {
      userId: user.id,
      displayName: user.name,
      fullName: user.name,
      email: user.email,
      emailVerified: user.email_verified === 1,
    };
  }
  async function rate(key: string, limit: number, seconds: number) {
    const now = clock();
    const id = sha256(key);
    await statement(
      `INSERT INTO auth_rate_limits (id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN auth_rate_limits.expires_at<=? THEN 1 ELSE auth_rate_limits.count+1 END, expires_at=CASE WHEN auth_rate_limits.expires_at<=? THEN excluded.expires_at ELSE auth_rate_limits.expires_at END`,
      id,
      now + seconds * 1000,
      now,
      now,
    ).run();
    const value = await statement(
      'SELECT count FROM auth_rate_limits WHERE id=?',
      id,
    ).first<{ count: number }>();
    if (!value || value.count > limit)
      throw new AuthError(
        429,
        'Demasiados intentos. Espera unos minutos antes de volver a intentar.',
      );
  }
  async function parseBody(request: Request): Promise<Record<string, unknown>> {
    let configured: URL;
    try {
      configured = new URL(env.APP_ORIGIN || '');
    } catch {
      throw new AuthError(
        503,
        'La autenticación aún necesita configurar el dominio de la aplicación.',
      );
    }
    if (
      configured.origin !== env.APP_ORIGIN ||
      (secure && configured.protocol !== 'https:')
    )
      throw new AuthError(
        503,
        'La autenticación aún necesita configurar su dominio seguro.',
      );
    if (request.headers.get('origin') !== configured.origin)
      throw new AuthError(403, 'Origen de solicitud no permitido.');
    if (
      !(request.headers.get('content-type') || '')
        .toLowerCase()
        .startsWith('application/json')
    )
      throw new AuthError(415, 'Se requiere una solicitud JSON.');
    if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES)
      throw new AuthError(413, 'Solicitud demasiado grande.');
    const text = await request.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES)
      throw new AuthError(413, 'Solicitud demasiado grande.');
    try {
      const value = JSON.parse(text);
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error();
      return value;
    } catch {
      throw new AuthError(400, 'Solicitud no válida.');
    }
  }
  function sessionStatement(userId: string, token: string) {
    return statement(
      'INSERT INTO auth_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)',
      sha256(token),
      userId,
      clock(),
      clock() + SESSION_SECONDS * 1000,
    );
  }
  async function handle(request: Request, action: string): Promise<Response> {
    try {
      if (request.method === 'GET' && action === 'session')
        return json({ user: await session(request.headers) });
      if (request.method === 'GET' && action === 'status') {
        const claimed = await statement(
          'SELECT id FROM auth_bootstrap WHERE id=1',
        ).first();
        return json({
          setupAvailable: setupConfigured && !claimed,
          emailVerificationAvailable: false,
          passwordResetAvailable: false,
        });
      }
      if (request.method !== 'POST')
        return json({ error: 'Método no permitido.' }, 405);
      if (!['login', 'register', 'logout', 'setup'].includes(action))
        return json({ error: 'Ruta no encontrada.' }, 404);
      const body = await parseBody(request);
      if (action === 'logout') {
        const token = tokenFromHeaders(request.headers);
        if (token)
          await statement(
            'DELETE FROM auth_sessions WHERE token_hash=?',
            sha256(token),
          ).run();
        return json({ ok: true, returnTo: '/' }, 200, cookie('', 0));
      }
      if (action === 'setup') {
        if (
          !setupConfigured ||
          (await statement('SELECT id FROM auth_bootstrap WHERE id=1').first())
        )
          throw new AuthError(
            403,
            'La configuración de administrador no está disponible.',
          );
        const token = typeof body.token === 'string' ? body.token : '';
        if (
          token.length > 512 ||
          !timingSafeEqual(
            Buffer.from(sha256(token), 'hex'),
            Buffer.from(sha256(env.ADMIN_SETUP_TOKEN!), 'hex'),
          )
        )
          throw new AuthError(403, 'La clave de configuración no es válida.');
        // Only a holder of the 256-bit setup secret may consume this budget.
        // Invalid public attempts must never lock out the owner's bootstrap.
        await rate('setup:global', 20, 900);
        const email = normalizeEmail(body.email);
        if (email !== reservedEmails[0])
          throw new AuthError(
            403,
            'Ese correo no está autorizado para configurar la cuenta administradora.',
          );
        const name = normalizeName(body.name);
        const passwordHash = await hashPassword(
          validatePassword(body.password),
        );
        const userId = randomUUID();
        const sessionToken = randomBytes(32).toString('hex');
        const createdAt = new Date(clock()).toISOString();
        try {
          // The singleton and all account/session writes succeed together or roll back.
          await db.batch([
            statement(
              'INSERT INTO auth_bootstrap (id,claimed_at) VALUES (1,?)',
              createdAt,
            ),
            statement(
              "INSERT INTO users (id,email,name,plan,role,suspended,profile,created_at) VALUES (?,?,?,'Free','super_admin',0,'{}',?)",
              userId,
              email,
              name,
              createdAt,
            ),
            statement(
              'INSERT INTO auth_accounts (user_id,email,password_hash,email_verified,created_at) VALUES (?,?,?,0,?)',
              userId,
              email,
              passwordHash,
              createdAt,
            ),
            sessionStatement(userId, sessionToken),
          ]);
        } catch (error) {
          if (/UNIQUE constraint|constraint failed/i.test(String(error)))
            throw new AuthError(
              409,
              'La cuenta administradora ya fue configurada o el correo no está disponible.',
            );
          throw error;
        }
        return json(
          { ok: true, returnTo: '/admin', emailVerified: false },
          201,
          cookie(sessionToken),
        );
      }
      const email = normalizeEmail(body.email);
      await rate(
        `${action}:email:${email}`,
        action === 'register' ? 5 : 10,
        900,
      );
      // Emergency ceiling for the 512 MB instance: bounded scrypt derivations
      // remain expensive even when an attacker rotates email addresses.
      // Already-throttled accounts cannot exhaust this shared ceiling.
      await rate(`${action}:global`, action === 'register' ? 60 : 300, 900);
      if (action === 'register') {
        if (reservedEmails.includes(email))
          throw new AuthError(
            400,
            'Ese correo está reservado para la configuración de administración.',
          );
        const name = normalizeName(body.name);
        const passwordHash = await hashPassword(
          validatePassword(body.password),
        );
        const userId = randomUUID();
        const sessionToken = randomBytes(32).toString('hex');
        const createdAt = new Date(clock()).toISOString();
        try {
          await db.batch([
            statement(
              "INSERT INTO users (id,email,name,plan,role,suspended,profile,created_at) VALUES (?,?,?,'Free','user',0,'{}',?)",
              userId,
              email,
              name,
              createdAt,
            ),
            statement(
              'INSERT INTO auth_accounts (user_id,email,password_hash,email_verified,created_at) VALUES (?,?,?,0,?)',
              userId,
              email,
              passwordHash,
              createdAt,
            ),
            sessionStatement(userId, sessionToken),
          ]);
        } catch (error) {
          if (/UNIQUE constraint|constraint failed/i.test(String(error)))
            throw new AuthError(
              409,
              'No se pudo crear esa cuenta. Si ya tienes una, inicia sesión.',
            );
          throw error;
        }
        return json(
          {
            ok: true,
            returnTo: safeReturnPath(body.returnTo),
            emailVerified: false,
          },
          201,
          cookie(sessionToken),
        );
      }
      const password = typeof body.password === 'string' ? body.password : '';
      if (password.length > 128)
        throw new AuthError(400, 'La contraseña supera la longitud permitida.');
      const account = await statement(
        'SELECT a.user_id,a.password_hash,u.suspended FROM auth_accounts a JOIN users u ON u.id=a.user_id WHERE a.email=?',
        email,
      ).first<{ user_id: string; password_hash: string; suspended: number }>();
      const matches = await verifyPassword(
        password,
        account?.password_hash || '',
      );
      if (!matches || !account || account.suspended)
        throw new AuthError(
          401,
          'Correo o contraseña incorrectos, o cuenta no disponible.',
        );
      const sessionToken = randomBytes(32).toString('hex');
      await db.batch([
        statement('DELETE FROM auth_sessions WHERE expires_at<=?', clock()),
        sessionStatement(account.user_id, sessionToken),
      ]);
      return json(
        { ok: true, returnTo: safeReturnPath(body.returnTo) },
        200,
        cookie(sessionToken),
      );
    } catch (error) {
      if (error instanceof AuthError)
        return json({ error: error.message }, error.status);
      console.error(
        'Authentication operation failed:',
        error instanceof Error ? error.name : 'unknown error',
      );
      return json(
        {
          error:
            'No se pudo completar la autenticación. Intenta de nuevo más tarde.',
        },
        500,
      );
    }
  }
  return { handle, session, cookieName };
}
