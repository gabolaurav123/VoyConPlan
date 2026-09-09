import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function migrationDatabasePath() {
  if (process.env.NODE_ENV === 'production') throw new Error('SQLite is disabled in production. Configure DATABASE_URL for external PostgreSQL.');
  const configured = process.env.DATABASE_PATH?.trim();
  if (configured) {
    if (!isAbsolute(configured)) throw new Error('DATABASE_PATH must be an absolute filesystem path.');
    return resolve(configured);
  }
  return resolve(process.cwd(), 'work', 'local-voyconplan.sqlite');
}

/** Apply checked-in migrations only, atomically, with drift detection. */
export function migrateDatabaseFile(databasePath, migrationDirectory = resolve(process.cwd(), 'drizzle')) {
  if (!isAbsolute(databasePath)) throw new Error('SQLite database path must be absolute.');
  const migrations = readdirSync(migrationDirectory)
    .filter((name) => /^\d+_[A-Za-z0-9_-]+\.sql$/.test(name))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(migrationDirectory, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
  if (!migrations.length) throw new Error('No SQL migrations were found; refusing to start with an empty schema.');
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  const applied = [];
  try {
    db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;');
    db.exec('CREATE TABLE IF NOT EXISTS __voyconplan_migrations (name TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)');
    const known = new Set(migrations.map((migration) => migration.name));
    for (const row of db.prepare('SELECT name FROM __voyconplan_migrations').all()) {
      if (!known.has(row.name)) throw new Error(`Applied migration is missing from the release: ${row.name}`);
    }
    for (const migration of migrations) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const prior = db.prepare('SELECT checksum FROM __voyconplan_migrations WHERE name=?').get(migration.name);
        if (prior) {
          if (prior.checksum !== migration.checksum) throw new Error(`Migration checksum changed: ${migration.name}`);
        } else {
          db.exec(migration.sql);
          db.prepare('INSERT INTO __voyconplan_migrations(name,checksum,applied_at) VALUES (?,?,?)').run(migration.name, migration.checksum, new Date().toISOString());
          applied.push(migration.name);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    return { applied, total: migrations.length };
  } finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.env.DATABASE_URL?.trim()) {
      const { migratePostgres } = await import('./migrate-postgres.mjs');
      const result = await migratePostgres();
      console.log(`PostgreSQL schema ready: ${result.applied.length} applied, ${result.total} checked.`);
    } else if (process.env.NODE_ENV === 'production') {
      console.log('DATABASE_URL is not configured. Starting the public demo; account and saved-trip operations are unavailable. No local database will be created.');
    } else {
      const result = migrateDatabaseFile(migrationDatabasePath());
      console.log(`Local SQLite schema ready: ${result.applied.length} applied, ${result.total} checked.`);
    }
  } catch (error) {
    // Driver errors can include connection details. Keep runtime logs secret-free.
    console.error('Database migration failed. Check the connection, TLS settings, migration files and database permissions.');
    process.exitCode = 1;
  }
}
