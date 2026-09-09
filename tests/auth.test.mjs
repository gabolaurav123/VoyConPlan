import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { openNodeDatabase } from '../db/node.ts';
import {
  createAuthService,
  hashPassword,
  verifyPassword,
  safeReturnPath,
} from '../lib/auth.ts';

const workRoot = resolve('work');
mkdirSync(workRoot, { recursive: true });
const fixtureRoot = mkdtempSync(join(workRoot, 'auth-tests-'));
const databases = [];
after(() => {
  for (const db of databases) db.close();
  if (
    !fixtureRoot.startsWith(workRoot + '\\') &&
    !fixtureRoot.startsWith(workRoot + '/')
  )
    throw new Error('Unsafe test cleanup path');
  rmSync(fixtureRoot, { recursive: true, force: true });
});
async function fixture(overrides = {}) {
  const db = openNodeDatabase(
    join(fixtureRoot, randomBytes(6).toString('hex') + '.sqlite'),
  );
  databases.push(db);
  for (const name of readdirSync('drizzle')
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    for (const sql of readFileSync(join('drizzle', name), 'utf8')
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  }
  let time = Date.now();
  const env = {
    NODE_ENV: 'production',
    APP_ORIGIN: 'https://voyconplan.test',
    ADMIN_EMAILS: 'admin@example.test',
    ADMIN_SETUP_TOKEN: randomBytes(32).toString('base64url'),
    ...overrides,
  };
  const service = createAuthService({ db, env, clock: () => time });
  const request = (action, body = {}, extras = {}) =>
    service.handle(
      new Request(`${env.APP_ORIGIN}/api/auth/${action}`, {
        method: 'POST',
        headers: {
          Origin: env.APP_ORIGIN,
          'Content-Type': 'application/json',
          ...extras,
        },
        body: JSON.stringify(body),
      }),
      action,
    );
  return {
    db,
    env,
    service,
    request,
    advance: (ms) => {
      time += ms;
    },
  };
}
const password = 'Una frase secreta de prueba 729!';
const registration = {
  email: 'travel@example.test',
  name: 'Persona de prueba',
  password,
};
const cookieOf = (response) => response.headers.get('set-cookie').split(';')[0];
const count = async (db, table) =>
  Number((await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n);

test('scrypt usa sal independiente y verifica sin almacenar la contraseña', async () => {
  const one = await hashPassword(password);
  const two = await hashPassword(password);
  assert.notEqual(one, two);
  assert.equal(one.includes(password), false);
  assert.equal(await verifyPassword(password, one), true);
  assert.equal(await verifyPassword('contraseña incorrecta', one), false);
  assert.equal(await verifyPassword(password, 'formato malicioso'), false);
  await assert.rejects(hashPassword('corta'));
  await assert.rejects(hashPassword('x'.repeat(129)));
});
test('registro crea usuario sin privilegios y sesión opaca con cookie segura', async () => {
  const f = await fixture();
  const response = await f.request('register', {
    ...registration,
    role: 'super_admin',
    emailVerified: true,
    returnTo: '/viajes?test=1',
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).returnTo, '/viajes?test=1');
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /^__Host-vcp_session=[a-f0-9]{64};/);
  for (const attribute of [
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=1209600',
  ])
    assert.ok(cookie.includes(attribute));
  const user = await f.db.prepare('SELECT * FROM users').first();
  assert.equal(user.role, 'user');
  const account = await f.db.prepare('SELECT * FROM auth_accounts').first();
  assert.equal(account.email_verified, 0);
  assert.notEqual(account.password_hash, password);
  const token = cookieOf(response).split('=')[1];
  const stored = await f.db.prepare('SELECT * FROM auth_sessions').first();
  assert.equal(
    stored.token_hash,
    createHash('sha256').update(token).digest('hex'),
  );
  assert.notEqual(stored.token_hash, token);
  const session = await f.service.session(
    new Headers({ Cookie: cookieOf(response) }),
  );
  assert.equal(session.email, registration.email);
  assert.equal(session.emailVerified, false);
});
test('identidad falsificada por headers y cookies arbitrarias no autentica', async () => {
  const f = await fixture();
  assert.equal(
    await f.service.session(
      new Headers({
        'oai-authenticated-user-id': 'root',
        'oai-authenticated-user-email': 'admin@example.test',
        'cf-access-authenticated-user-email': 'admin@example.test',
      }),
    ),
    null,
  );
  assert.equal(
    await f.service.session(
      new Headers({ Cookie: '__Host-vcp_session=' + '0'.repeat(64) }),
    ),
    null,
  );
});
test('correo reservado no permite registrar un administrador sin clave', async () => {
  const f = await fixture();
  const response = await f.request('register', {
    ...registration,
    email: 'ADMIN@EXAMPLE.TEST',
  });
  assert.equal(response.status, 400);
  assert.equal(await count(f.db, 'users'), 0);
});
test('bootstrap comprueba clave y correo; es único y transaccional bajo concurrencia', async () => {
  const f = await fixture();
  const body = {
    name: 'Propietario',
    email: 'admin@example.test',
    password,
    token: f.env.ADMIN_SETUP_TOKEN,
  };
  assert.equal(
    (await f.request('setup', { ...body, token: 'wrong' })).status,
    403,
  );
  assert.equal(
    (await f.request('setup', { ...body, email: 'other@example.test' })).status,
    403,
  );
  assert.equal(await count(f.db, 'auth_bootstrap'), 0);
  const responses = await Promise.all([
    f.request('setup', body),
    f.request('setup', body),
  ]);
  assert.equal(responses.filter((r) => r.status === 201).length, 1);
  assert.ok(responses.some((r) => r.status === 409 || r.status === 403));
  assert.equal(await count(f.db, 'users'), 1);
  assert.equal(await count(f.db, 'auth_sessions'), 1);
  assert.equal(await count(f.db, 'auth_bootstrap'), 1);
  const user = await f.db.prepare('SELECT role,email FROM users').first();
  assert.equal(user.role, 'super_admin');
  assert.equal(user.email, 'admin@example.test');
  assert.equal((await f.request('setup', body)).status, 403);
});
test('un token de setup débil o ausente deshabilita el alta administradora', async () => {
  const f = await fixture({ ADMIN_SETUP_TOKEN: 'short' });
  const response = await f.request('setup', {
    ...registration,
    email: 'admin@example.test',
    token: 'short',
  });
  assert.equal(response.status, 403);
  assert.equal(await count(f.db, 'users'), 0);
});
test('intentos de setup con clave inválida no bloquean la activación legítima', async () => {
  const f = await fixture();
  const body = {
    name: 'Propietario',
    email: 'admin@example.test',
    password,
    token: f.env.ADMIN_SETUP_TOKEN,
  };
  for (let i = 0; i < 50; i++) {
    const invalid = await f.request('setup', {
      ...body,
      token: 'invalid-' + i,
    });
    assert.equal(invalid.status, 403);
  }
  assert.equal(await count(f.db, 'auth_rate_limits'), 0);
  assert.equal(await count(f.db, 'auth_bootstrap'), 0);
  const valid = await f.request('setup', body);
  assert.equal(valid.status, 201);
  assert.equal(await count(f.db, 'auth_bootstrap'), 1);
  assert.equal(await count(f.db, 'users'), 1);
});
test('duplicado de correo revierte todas las escrituras del registro', async () => {
  const f = await fixture();
  assert.equal((await f.request('register', registration)).status, 201);
  assert.equal(
    (
      await f.request('register', {
        ...registration,
        email: registration.email.toUpperCase(),
      })
    ).status,
    409,
  );
  assert.equal(await count(f.db, 'users'), 1);
  assert.equal(await count(f.db, 'auth_accounts'), 1);
  assert.equal(await count(f.db, 'auth_sessions'), 1);
});
test('login verifica contraseña, suspensiones y nueva sesión independiente', async () => {
  const f = await fixture();
  const registrationResponse = await f.request('register', registration);
  assert.equal(
    (
      await f.request('login', {
        email: registration.email,
        password: 'incorrecta',
      })
    ).status,
    401,
  );
  const login = await f.request('login', {
    email: registration.email,
    password,
  });
  assert.equal(login.status, 200);
  assert.notEqual(cookieOf(login), cookieOf(registrationResponse));
  await f.db.prepare('UPDATE users SET suspended=1').run();
  assert.equal(
    await f.service.session(new Headers({ Cookie: cookieOf(login) })),
    null,
  );
  assert.equal(
    (await f.request('login', { email: registration.email, password })).status,
    401,
  );
});
test('logout exige POST con Origin exacto y revoca únicamente su sesión', async () => {
  const f = await fixture();
  const one = await f.request('register', registration);
  const two = await f.request('login', { email: registration.email, password });
  const badOrigin = await f.request(
    'logout',
    {},
    { Cookie: cookieOf(one), Origin: 'https://evil.test' },
  );
  assert.equal(badOrigin.status, 403);
  assert.notEqual(
    await f.service.session(new Headers({ Cookie: cookieOf(one) })),
    null,
  );
  const get = await f.service.handle(
    new Request(f.env.APP_ORIGIN + '/api/auth/logout', {
      headers: { Cookie: cookieOf(one) },
    }),
    'logout',
  );
  assert.equal(get.status, 405);
  const response = await f.request('logout', {}, { Cookie: cookieOf(one) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(
    await f.service.session(new Headers({ Cookie: cookieOf(one) })),
    null,
  );
  assert.notEqual(
    await f.service.session(new Headers({ Cookie: cookieOf(two) })),
    null,
  );
});
test('sesión expira a los 14 días; duplicar cookie se rechaza', async () => {
  const f = await fixture();
  const response = await f.request('register', registration);
  const cookie = cookieOf(response);
  assert.equal(
    await f.service.session(new Headers({ Cookie: cookie + '; ' + cookie })),
    null,
  );
  f.advance(14 * 24 * 60 * 60 * 1000);
  assert.equal(await f.service.session(new Headers({ Cookie: cookie })), null);
});
test('rate limit por correo no se evade falsificando IP y se recupera al expirar', async () => {
  const f = await fixture();
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await f.request(
          'login',
          { email: registration.email, password: 'incorrecta' },
          { 'X-Forwarded-For': `10.0.0.${i}` },
        )
      ).status,
      401,
    );
  assert.equal(
    (await f.request('login', { email: registration.email, password })).status,
    429,
  );
  const globalBucket = await f.db
    .prepare('SELECT count FROM auth_rate_limits WHERE id=?')
    .bind(createHash('sha256').update('login:global').digest('hex'))
    .first();
  assert.equal(
    globalBucket.count,
    10,
    'El correo ya limitado no consume el techo compartido',
  );
  f.advance(901_000);
  assert.equal(
    (await f.request('login', { email: registration.email, password })).status,
    401,
  );
});
test('API rechaza cuerpo excesivo, Origin ausente y dominio inseguro en producción', async () => {
  const f = await fixture();
  assert.equal(
    (await f.request('register', registration, { Origin: '' })).status,
    403,
  );
  assert.equal(
    (await f.request('register', { ...registration, name: 'x'.repeat(13000) }))
      .status,
    413,
  );
  const insecure = await fixture({ APP_ORIGIN: 'http://voyconplan.test' });
  assert.equal((await insecure.request('register', registration)).status, 503);
});
test('redirección sólo permite rutas internas y no vuelve al flujo auth', () => {
  for (const value of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/entrar',
    '/api/auth/logout',
    '/configurar-admin',
  ])
    assert.equal(safeReturnPath(value), '/viajes');
  assert.equal(
    safeReturnPath('/compartir/abc?source=login'),
    '/compartir/abc?source=login',
  );
});
