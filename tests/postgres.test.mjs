import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { PostgresDatabase, postgresSql } from '../db/postgres.ts';
import { postgresPoolOptions } from '../db/postgres-config.ts';
import { migratePostgresClient } from '../scripts/migrate-postgres.mjs';
import { createAuthService } from '../lib/auth.ts';
import { randomBytes } from 'node:crypto';

// PGlite runs the PostgreSQL engine in process. Its single session is serialized
// by this test transport; it does not claim to test network/TLS or multi-session SSI.
async function fixture(t) {
  const pg = await PGlite.create();
  let tail = Promise.resolve();
  async function acquire() {
    const before = tail;
    let release;
    tail = new Promise((resolve) => { release = resolve; });
    await before;
    return release;
  }
  async function query(sql, values) {
    const result = values?.length ? await pg.query(sql, values) : (await pg.exec(sql)).at(-1);
    return { rows: result?.rows || [], rowCount: result?.affectedRows || 0, command: sql.trim().match(/^[A-Za-z]+/)?.[0].toUpperCase() };
  }
  const pool = {
    async connect() { const release = await acquire(); return { query, release }; },
    async query(sql, values) { const release = await acquire(); try { return await query(sql, values); } finally { release(); } },
    async end() { await pg.close(); },
  };
  const db = new PostgresDatabase(pool);
  t.after(() => db.close());
  return { db, client: { query }, pg, pool };
}

test('PostgreSQL placeholders preserve quoted strings, identifiers, comments and dollar literals', () => {
  assert.equal(postgresSql("SELECT ?, '?', \"?\", $$?$$, $tag$?$tag$ -- ?\n/* ? */ WHERE id=?"), "SELECT $1, '?', \"?\", $$?$$, $tag$?$tag$ -- ?\n/* ? */ WHERE id=$2");
  assert.throws(() => postgresSql("SELECT 'unfinished"), /Unterminated/);
});

test('external database TLS defaults to certificate verification and rejects accidental unsafe configuration', () => {
  const base = { DATABASE_URL: 'postgresql://example:fake@db.example.invalid/voyconplan?sslmode=require' };
  const options = postgresPoolOptions(base);
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(new URL(options.connectionString).searchParams.has('sslmode'), false);
  assert.equal(options.max, 5);
  assert.equal(postgresPoolOptions({ ...base, DATABASE_SSL_MODE: 'disable' }).ssl, false);
  assert.throws(() => postgresPoolOptions({ ...base, DATABASE_SSL_MODE: 'allow' }), /verify-full/);
  assert.throws(() => postgresPoolOptions({ DATABASE_URL: 'mysql://localhost/db' }), /PostgreSQL/);
  assert.throws(() => postgresPoolOptions({ ...base, DATABASE_POOL_MAX: '99' }), /between 1 and 20/);
});

test('PostgreSQL migrations apply twice safely, preserve rows and detect checksum drift', async (t) => {
  const { db, client } = await fixture(t);
  const first = await migratePostgresClient(client);
  assert.equal(first.applied.length, 2);
  await db.prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('persist', 'yes').run();
  const again = await migratePostgresClient(client);
  assert.deepEqual(again.applied, []);
  assert.equal(await db.prepare('SELECT value FROM settings WHERE key=?').bind('persist').first('value'), 'yes');
  await client.query("UPDATE __voyconplan_migrations SET checksum='changed' WHERE name='0001_auth.sql'");
  await assert.rejects(migratePostgresClient(client), /checksum changed/);
});

test('PostgreSQL batch rolls back preceding RETURNING writes and bound SQL stays data', async (t) => {
  const { db, client } = await fixture(t);
  await migratePostgresClient(client);
  await assert.rejects(db.batch([
    db.prepare('INSERT INTO settings(key,value) VALUES (?,?) RETURNING key').bind('key', 'one'),
    db.prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('key', 'duplicate'),
  ]), (error) => error.code === '23505');
  assert.equal(await db.prepare('SELECT * FROM settings WHERE key=?').bind('key').first(), null);
  const attack = "'); DROP TABLE users; --";
  const result = await db.prepare('INSERT INTO settings(key,value) VALUES (?,?) RETURNING value').bind('safe', attack).run();
  assert.equal(result.meta.changes, 1);
  assert.equal(result.results[0].value, attack);
  assert.equal(Number(await db.prepare('SELECT COUNT(*) AS count FROM users').first('count')), 0);
});

test('PostgreSQL auth setup, opaque sessions, duplicate email and cascade use the remote schema', async (t) => {
  const { db, client } = await fixture(t);
  await migratePostgresClient(client);
  const env = { APP_ORIGIN: 'https://voyconplan.test', NODE_ENV: 'production', ADMIN_EMAILS: 'admin@example.test', ADMIN_SETUP_TOKEN: randomBytes(32).toString('base64url') };
  const auth = createAuthService({ db, env });
  const request = (action, body) => auth.handle(new Request(env.APP_ORIGIN + '/api/auth/' + action, { method: 'POST', headers: { origin: env.APP_ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify(body) }), action);
  const credentials = { email: env.ADMIN_EMAILS, name: 'Admin', password: 'Long local test password 729!', token: env.ADMIN_SETUP_TOKEN };
  assert.equal((await request('register', credentials)).status, 400);
  const setup = await request('setup', credentials);
  assert.equal(setup.status, 201);
  const cookie = setup.headers.get('set-cookie').split(';')[0];
  const session = await auth.session(new Headers({ cookie }));
  assert.equal(session.email, env.ADMIN_EMAILS);
  assert.equal(await db.prepare('SELECT role FROM users WHERE id=?').bind(session.userId).first('role'), 'super_admin');
  const member = { ...credentials, email: 'member@example.test', name: 'Member' };
  assert.equal((await request('register', member)).status, 201);
  assert.equal((await request('register', member)).status, 409);
  await db.prepare('DELETE FROM users WHERE id=?').bind(session.userId).run();
  assert.equal(await auth.session(new Headers({ cookie })), null);
});

test('portable quota batches accept exactly two of eight requests in PostgreSQL', async (t) => {
  const { db, client } = await fixture(t);
  await migratePostgresClient(client);
  await db.prepare('INSERT INTO users(id,email,name,created_at) VALUES (?,?,?,?)').bind('u', 'quota@example.test', 'Quota', 'now').run();
  await Promise.all(Array.from({ length: 8 }, async (_, i) => {
    const id = 'trip-' + i;
    await db.batch([
      db.prepare('INSERT INTO usage(id,user_id,used) VALUES (?,?,0) ON CONFLICT DO NOTHING').bind('quota', 'u'),
      db.prepare('INSERT INTO trips(id,owner_id,data,created_at,updated_at) SELECT ?,?,?,?,? WHERE (SELECT used FROM usage WHERE id=?)<? ON CONFLICT DO NOTHING').bind(id, 'u', '{}', 'now', 'now', 'quota', 2),
      db.prepare('UPDATE usage SET used=used+1 WHERE id=? AND EXISTS(SELECT 1 FROM trips WHERE id=?) AND NOT EXISTS(SELECT 1 FROM records WHERE id=?)').bind('quota', id, 'request:' + id),
      db.prepare('INSERT INTO records(id,kind,owner_id,data,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM trips WHERE id=?) ON CONFLICT DO NOTHING').bind('request:' + id, 'create_request', 'u', '{}', 'now', id),
    ]);
  }));
  assert.equal(Number(await db.prepare('SELECT COUNT(*) AS count FROM trips').first('count')), 2);
  assert.equal(await db.prepare('SELECT used FROM usage WHERE id=?').bind('quota').first('used'), 2);
});

test('serialization failures retry the whole transaction on the same acquired client and always release it', async () => {
  const calls = [];
  let attempts = 0, released = 0;
  const pool = {
    async connect() {
      const number = ++attempts;
      return {
        async query(sql) {
          calls.push([number, sql]);
          if (number === 1 && sql.startsWith('UPDATE')) throw Object.assign(new Error('serialization'), { code: '40001' });
          return { rows: [], command: sql.startsWith('UPDATE') ? 'UPDATE' : '', rowCount: 1 };
        },
        release() { released++; },
      };
    },
    async query() { throw new Error('Transaction must not use pool.query'); }, async end() {},
  };
  const db = new PostgresDatabase(pool);
  const result = await db.batch([db.prepare('UPDATE settings SET value=? WHERE key=?').bind('new', 'key')]);
  assert.equal(attempts, 2); assert.equal(released, 2); assert.equal(result[0].meta.changes, 1);
  assert.ok(calls.some(([n, sql]) => n === 1 && sql === 'ROLLBACK'));
  assert.ok(calls.some(([n, sql]) => n === 2 && sql === 'COMMIT'));
  assert.equal(calls.filter(([, sql]) => sql === 'BEGIN ISOLATION LEVEL SERIALIZABLE').length, 2);
});
