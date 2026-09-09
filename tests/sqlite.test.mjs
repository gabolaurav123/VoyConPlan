import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { spawnSync } from 'node:child_process';
import { openNodeDatabase, resolveDatabasePath, databaseConfigured, getNodeDb } from '../db/node.ts';
import { migrateDatabaseFile, migrationDatabasePath } from '../scripts/migrate.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const testRoot = resolve(projectRoot, 'work', 'sqlite-tests');
const migrations = resolve(projectRoot, 'drizzle');
mkdirSync(testRoot, { recursive: true });

function fixture(t) {
  const directory = mkdtempSync(join(testRoot, 'case-'));
  t.after(() => {
    const target = resolve(directory);
    assert.ok(target.startsWith(testRoot + sep), 'cleanup stays in this test workspace');
    rmSync(target, { recursive: true, force: true });
  });
  return { directory, path: join(directory, 'test.sqlite') };
}

test('migrations apply once, verify checksums, and preserve persisted data', async (t) => {
  const f = fixture(t);
  const first = migrateDatabaseFile(f.path, migrations);
  assert.ok(first.applied.length > 0);
  let db = openNodeDatabase(f.path);
  await db.prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('persistent', 'still here').run();
  db.close();
  const second = migrateDatabaseFile(f.path, migrations);
  assert.deepEqual(second.applied, []);
  assert.equal(second.total, first.total);
  db = openNodeDatabase(f.path);
  assert.equal(await db.prepare('SELECT value FROM settings WHERE key=?').bind('persistent').first('value'), 'still here');
  const fk = await db.prepare('PRAGMA foreign_keys').first('foreign_keys');
  assert.equal(fk, 1);
  assert.equal(await db.prepare('PRAGMA journal_mode').first('journal_mode'), 'wal');
  assert.equal(await db.prepare('PRAGMA busy_timeout').first('timeout'), 5000);
  db.close();
});

test('migration drift fails before executing altered SQL', async (t) => {
  const f = fixture(t);
  const folder = join(f.directory, 'migrations');
  mkdirSync(folder);
  for (const name of readdirSync(migrations).filter((name) => name.endsWith('.sql'))) {
    copyFileSync(join(migrations, name), join(folder, name));
  }
  migrateDatabaseFile(f.path, folder);
  const first = readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()[0];
  writeFileSync(join(folder, first), readFileSync(join(folder, first), 'utf8') + '\n-- changed\n');
  assert.throws(() => migrateDatabaseFile(f.path, folder), /checksum changed/);
});

test('a failing migration rolls back schema and migration marker', (t) => {
  const f = fixture(t);
  const folder = join(f.directory, 'migrations');
  mkdirSync(folder);
  writeFileSync(join(folder, '0000_failing.sql'), 'CREATE TABLE partial(id TEXT); INSERT INTO missing_table VALUES (1);');
  assert.throws(() => migrateDatabaseFile(f.path, folder), /missing_table/);
  const db = openNodeDatabase(f.path);
  return db.prepare("SELECT name FROM sqlite_master WHERE name='partial'").first().then((row) => {
    assert.equal(row, null);
    return db.prepare('SELECT COUNT(*) AS count FROM __voyconplan_migrations').first('count');
  }).then((count) => { assert.equal(count, 0); }).finally(() => db.close());
});

test('batch failure rolls back preceding writes including RETURNING', async (t) => {
  const f = fixture(t);
  migrateDatabaseFile(f.path, migrations);
  const db = openNodeDatabase(f.path);
  try {
    await assert.rejects(db.batch([
      db.prepare('INSERT INTO settings(key,value) VALUES (?,?) RETURNING key').bind('batch', 'must roll back'),
      db.prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('batch', 'duplicate'),
    ]), /UNIQUE/);
    assert.equal(await db.prepare('SELECT * FROM settings WHERE key=?').bind('batch').first(), null);
    const result = await db.batch([
      db.prepare('INSERT INTO settings(key,value) VALUES (?,?) RETURNING key,value').bind('working', 'yes'),
      db.prepare('SELECT value FROM settings WHERE key=?').bind('working'),
    ]);
    assert.equal(result[0].results[0].key, 'working');
    assert.equal(result[0].meta.changes, 1);
    assert.equal(result[1].results[0].value, 'yes');
    assert.equal(result[1].meta.changes, 0);
  } finally { db.close(); }
});

test('bound values cannot alter SQL and binding is immutable', async (t) => {
  const f = fixture(t);
  migrateDatabaseFile(f.path, migrations);
  const db = openNodeDatabase(f.path);
  try {
    const template = db.prepare('INSERT INTO settings(key,value) VALUES (?,?)');
    const first = template.bind('first', "'); DROP TABLE users; --");
    const second = template.bind('second', 'safe');
    await first.run();
    await second.run();
    assert.equal(await db.prepare('SELECT value FROM settings WHERE key=?').bind('first').first('value'), "'); DROP TABLE users; --");
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM users').first()).count, 0);
    assert.equal((await db.prepare('SELECT * FROM settings').all()).results.length, 2);
    assert.throws(() => template.bind(undefined, 'bad'), /parameters/);
  } finally { db.close(); }
});

test('foreign keys reject orphaned trips and cascades remain enabled', async (t) => {
  const f = fixture(t);
  migrateDatabaseFile(f.path, migrations);
  const db = openNodeDatabase(f.path);
  try {
    await assert.rejects(db.prepare('INSERT INTO trips(id,owner_id,data,created_at,updated_at) VALUES (?,?,?,?,?)').bind('t', 'missing', '{}', 'now', 'now').run(), /FOREIGN KEY/);
    await db.prepare('INSERT INTO users(id,email,name,created_at) VALUES (?,?,?,?)').bind('u', 'test@example.invalid', 'Test', 'now').run();
    await db.prepare('INSERT INTO trips(id,owner_id,data,created_at,updated_at) VALUES (?,?,?,?,?)').bind('t', 'u', '{}', 'now', 'now').run();
    await db.prepare('DELETE FROM users WHERE id=?').bind('u').run();
    assert.equal(await db.prepare('SELECT * FROM trips WHERE id=?').bind('t').first(), null);
  } finally { db.close(); }
});

test('independent concurrent connections respect the two-trip quota transaction', async (t) => {
  const f = fixture(t);
  migrateDatabaseFile(f.path, migrations);
  const db = openNodeDatabase(f.path);
  await db.prepare('INSERT INTO users(id,email,name,created_at) VALUES (?,?,?,?)').bind('u', 'quota@example.invalid', 'Quota', 'now').run();
  db.close();
  const workerSource = `
    const { parentPort, workerData } = require('node:worker_threads');
    (async () => {
      const { openNodeDatabase } = await import(workerData.adapter);
      const db = openNodeDatabase(workerData.path);
      try {
        const id = 'trip-' + workerData.index;
        await db.batch([
          db.prepare('INSERT OR IGNORE INTO usage(id,user_id,used) VALUES (?,?,0)').bind('quota', 'u'),
          db.prepare('INSERT OR IGNORE INTO trips(id,owner_id,data,created_at,updated_at) SELECT ?,?,?,?,? WHERE (SELECT used FROM usage WHERE id=?)<?').bind(id, 'u', '{}', 'now', 'now', 'quota', 2),
          db.prepare('UPDATE usage SET used=used+1 WHERE id=? AND EXISTS(SELECT 1 FROM trips WHERE id=?) AND NOT EXISTS(SELECT 1 FROM records WHERE id=?)').bind('quota', id, 'request:' + id),
          db.prepare('INSERT OR IGNORE INTO records(id,kind,owner_id,data,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM trips WHERE id=?)').bind('request:' + id, 'create_request', 'u', '{}', 'now', id)
        ]);
        parentPort.postMessage('done');
      } finally { db.close(); }
    })().catch((error) => { throw error; });
  `;
  await Promise.all(Array.from({ length: 8 }, (_, index) => new Promise((resolveWorker, reject) => {
    const worker = new Worker(workerSource, { eval: true, workerData: { path: f.path, index, adapter: new URL('../db/node.ts', import.meta.url).href } });
    worker.once('error', reject);
    worker.once('exit', (code) => code === 0 ? resolveWorker() : reject(new Error('Worker exited ' + code)));
  })));
  const finalDb = openNodeDatabase(f.path);
  try {
    assert.equal(await finalDb.prepare('SELECT COUNT(*) AS count FROM trips').first('count'), 2);
    assert.equal(await finalDb.prepare('SELECT used FROM usage WHERE id=?').bind('quota').first('used'), 2);
    assert.equal(await finalDb.prepare('SELECT COUNT(*) AS count FROM records').first('count'), 2);
  } finally { finalDb.close(); }
});

test('production path validation fails closed and importing does not create a file', (t) => {
  const f = fixture(t);
  const script = `import { getNodeDb, resolveDatabasePath } from ${JSON.stringify(new URL('../db/node.ts', import.meta.url).href)}; console.log('imported');`;
  const importResult = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, NODE_ENV: 'production', DATABASE_PATH: f.path }, encoding: 'utf8',
  });
  assert.equal(importResult.status, 0, importResult.stderr);
  assert.equal(existsSync(f.path), false);
  const previousPath = process.env.DATABASE_PATH;
  const previousMode = process.env.NODE_ENV;
  const previousUrl = process.env.DATABASE_URL;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_PATH;
    delete process.env.DATABASE_URL;
    assert.equal(databaseConfigured(), false);
    assert.throws(getNodeDb, (error) => error.code === 'DATABASE_NOT_CONFIGURED');
    assert.throws(resolveDatabasePath, /disabled in production/);
    assert.throws(migrationDatabasePath, /disabled in production/);
    process.env.DATABASE_PATH = f.path;
    assert.throws(getNodeDb, (error) => error.code === 'DATABASE_NOT_CONFIGURED');
    assert.throws(resolveDatabasePath, /disabled in production/);
    const startup = spawnSync(process.execPath, [resolve(projectRoot, 'scripts/migrate.mjs')], { env: process.env, encoding: 'utf8' });
    assert.equal(startup.status, 0, startup.stderr);
    assert.match(startup.stdout, /No local database will be created/);
    assert.equal(existsSync(f.path), false);
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_PATH = 'relative.sqlite';
    assert.throws(resolveDatabasePath, /absolute/);
    assert.throws(migrationDatabasePath, /absolute/);
    process.env.DATABASE_PATH = f.path;
    assert.equal(resolveDatabasePath(), f.path);
    assert.equal(migrationDatabasePath(), f.path);
  } finally {
    if (previousPath === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = previousPath;
    if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
  }
});
