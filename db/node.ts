import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { openPostgresDatabase } from './postgres.ts';

export type NodeRow = Record<string, unknown>;
export type NodeResult<T = NodeRow> = {
  success: true;
  results: T[];
  meta: { changes: number; last_row_id: number };
};

export interface NodeStatement {
  bind(...values: unknown[]): NodeStatement;
  first<T = NodeRow>(column?: string): Promise<T | null>;
  all<T = NodeRow>(): Promise<NodeResult<T>>;
  run<T = NodeRow>(): Promise<NodeResult<T>>;
}

export interface NodeDatabase {
  readonly path: string;
  prepare(sql: string): NodeStatement;
  batch<T = NodeRow>(statements: NodeStatement[]): Promise<NodeResult<T>[]>;
  close(): void | Promise<void>;
}

/** SQLite is a local-development backend only. */
export function resolveDatabasePath(): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SQLite is disabled in production. Configure DATABASE_URL for external PostgreSQL.');
  }
  const configured = process.env.DATABASE_PATH?.trim();
  if (configured) {
    if (!isAbsolute(configured)) throw new Error('DATABASE_PATH must be an absolute filesystem path.');
    return resolve(configured);
  }
  return resolve(process.cwd(), 'work', 'local-voyconplan.sqlite');
}

function bindValue(value: unknown): SQLInputValue {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Uint8Array) return value;
  throw new TypeError('SQLite parameters must be finite numbers, strings, booleans, blobs, bigint, or null.');
}

class Statement implements NodeStatement {
  readonly owner: SQLiteDatabase;
  private readonly sql: string;
  private readonly values: SQLInputValue[];

  constructor(owner: SQLiteDatabase, sql: string, values: SQLInputValue[] = []) {
    this.owner = owner;
    this.sql = sql;
    this.values = values;
  }

  bind(...values: unknown[]): NodeStatement {
    // Binding creates an independent statement, never mutable request state.
    return new Statement(this.owner, this.sql, values.map(bindValue));
  }

  execute<T = NodeRow>(): NodeResult<T> {
    const connection = this.owner.connection;
    const prepared = connection.prepare(this.sql);
    const before = connection.prepare('SELECT total_changes() AS count').get() as { count: number };
    // all() fully consumes RETURNING rows before COMMIT.
    const rows = prepared.columns().length
      ? prepared.all(...this.values)
      : (prepared.run(...this.values), []);
    const after = connection.prepare('SELECT total_changes() AS count, last_insert_rowid() AS last_id').get() as { count: number; last_id: number };
    return {
      success: true,
      results: rows as T[],
      meta: { changes: Number(after.count) - Number(before.count), last_row_id: Number(after.last_id) },
    };
  }

  async first<T = NodeRow>(column?: string): Promise<T | null> {
    const row = this.execute<NodeRow>().results[0];
    if (!row) return null;
    if (column !== undefined) {
      if (!Object.hasOwn(row, column)) throw new Error('Requested result column does not exist.');
      return row[column] as T;
    }
    return row as T;
  }

  async all<T = NodeRow>(): Promise<NodeResult<T>> { return this.execute<T>(); }
  async run<T = NodeRow>(): Promise<NodeResult<T>> { return this.execute<T>(); }
}

class SQLiteDatabase implements NodeDatabase {
  readonly connection: DatabaseSync;
  readonly path: string;

  constructor(path: string) {
    if (!isAbsolute(path)) throw new Error('SQLite database path must be absolute.');
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    this.connection = new DatabaseSync(path);
    try {
      this.connection.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;');
    } catch (error) {
      this.connection.close();
      throw error;
    }
  }

  prepare(sql: string): NodeStatement { return new Statement(this, sql); }

  async batch<T = NodeRow>(statements: NodeStatement[]): Promise<NodeResult<T>[]> {
    if (!statements.length) return [];
    for (const statement of statements) {
      if (!(statement instanceof Statement) || statement.owner !== this) {
        throw new TypeError('Every batch statement must belong to this database.');
      }
    }
    this.connection.exec('BEGIN IMMEDIATE');
    try {
      // Deliberately no await: quota check and write cannot interleave.
      // BEGIN IMMEDIATE also serializes other connections to this file.
      const results = statements.map((statement) => (statement as Statement).execute<T>());
      this.connection.exec('COMMIT');
      return results;
    } catch (error) {
      this.connection.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void { this.connection.close(); }
}

/** Independent connection for explicit lifecycle ownership and tests. */
export function openNodeDatabase(path: string): NodeDatabase { return new SQLiteDatabase(path); }

let singleton: NodeDatabase | undefined;

export class DatabaseNotConfiguredError extends Error {
  readonly status = 503;
  readonly code = 'DATABASE_NOT_CONFIGURED';
  constructor() { super('La base de datos externa todavía no está configurada.'); }
}

export function databaseConfigured(): boolean {
  return !!process.env.DATABASE_URL?.trim() || process.env.NODE_ENV !== 'production';
}

/** Lazy: importing server modules during a build never opens a file. */
export function getNodeDb(): NodeDatabase {
  if (!databaseConfigured()) throw new DatabaseNotConfiguredError();
  singleton ??= process.env.DATABASE_URL?.trim()
    ? openPostgresDatabase()
    : openNodeDatabase(resolveDatabasePath());
  return singleton;
}
