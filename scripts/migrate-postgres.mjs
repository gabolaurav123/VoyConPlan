import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { postgresPoolOptions } from '../db/postgres-config.ts';

/** Database already exists externally. This only migrates the selected schema. */
export async function migratePostgresClient(client, directory = resolve(process.cwd(), 'drizzle', 'postgres')) {
  const migrations = readdirSync(directory).filter((name) => /^\d+_[A-Za-z0-9_-]+\.sql$/.test(name)).sort().map((name) => {
    const sql = readFileSync(join(directory, name), 'utf8');
    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  });
  if (!migrations.length) throw new Error('No PostgreSQL migrations found.');
  const applied = [];
  // A dedicated session owns this advisory lock across the entire migration set.
  await client.query('SELECT pg_advisory_lock(1768328301)');
  try {
    await client.query('CREATE TABLE IF NOT EXISTS __voyconplan_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)');
    const known = new Set(migrations.map((migration) => migration.name));
    const old = await client.query('SELECT name FROM __voyconplan_migrations');
    for (const row of old.rows) if (!known.has(row.name)) throw new Error('Applied migration missing from release: ' + row.name);
    for (const migration of migrations) {
      await client.query('BEGIN');
      try {
        const prior = await client.query('SELECT checksum FROM __voyconplan_migrations WHERE name=$1', [migration.name]);
        if (prior.rows[0]) {
          if (prior.rows[0].checksum !== migration.checksum) throw new Error('Migration checksum changed: ' + migration.name);
        } else {
          await client.query(migration.sql);
          await client.query('INSERT INTO __voyconplan_migrations(name,checksum,applied_at) VALUES ($1,$2,$3)', [migration.name, migration.checksum, new Date().toISOString()]);
          applied.push(migration.name);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    return { applied, total: migrations.length };
  } finally { await client.query('SELECT pg_advisory_unlock(1768328301)'); }
}

export async function migratePostgres(env = process.env) {
  const pool = new Pool({ ...postgresPoolOptions(env), max: 1 });
  try {
    const client = await pool.connect();
    try { return await migratePostgresClient(client); }
    finally { client.release(); }
  } finally { await pool.end(); }
}
