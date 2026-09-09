import { Pool, types } from 'pg';
import type { PoolConfig } from 'pg';
import type { NodeDatabase, NodeStatement, NodeResult, NodeRow } from './node';
import { postgresPoolOptions } from './postgres-config.ts';

type QueryResult = { rows: Record<string, unknown>[]; rowCount?: number | null; command?: string };
export interface PostgresClient {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
  release(): void;
}
export interface PostgresPool {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
  connect(): Promise<PostgresClient>;
  end(): Promise<void>;
}

/** Only bind markers are translated. Quoted text, identifiers and comments stay literal. */
export function postgresSql(sql: string): string {
  let result = '', index = 0;
  let quote = '', dollar = '', lineComment = false, blockDepth = 0;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i], next = sql[i + 1];
    if (lineComment) { result += char; if (char === '\n') lineComment = false; continue; }
    if (blockDepth) {
      result += char;
      if (char === '/' && next === '*') { result += next; i++; blockDepth++; }
      else if (char === '*' && next === '/') { result += next; i++; blockDepth--; }
      continue;
    }
    if (dollar) {
      if (sql.startsWith(dollar, i)) { result += dollar; i += dollar.length - 1; dollar = ''; }
      else result += char;
      continue;
    }
    if (quote) {
      result += char;
      if (char === quote) {
        if (next === quote) { result += next; i++; } else quote = '';
      }
      continue;
    }
    if (char === '-' && next === '-') { result += '--'; i++; lineComment = true; continue; }
    if (char === '/' && next === '*') { result += '/*'; i++; blockDepth = 1; continue; }
    if (char === "'" || char === '"') { quote = char; result += char; continue; }
    if (char === '$') {
      const match = /^(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)/.exec(sql.slice(i));
      if (match) { dollar = match[0]; result += dollar; i += dollar.length - 1; continue; }
    }
    result += char === '?' ? '$' + (++index) : char;
  }
  if (quote || dollar || blockDepth) throw new Error('Unterminated SQL quote or comment.');
  return result;
}

function parameter(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new TypeError('Database parameters must be finite numbers, strings, booleans, blobs, bigint, or null.');
}

class Statement implements NodeStatement {
  readonly owner: PostgresDatabase;
  readonly sql: string;
  readonly values: unknown[];
  constructor(owner: PostgresDatabase, sql: string, values: unknown[] = []) {
    this.owner = owner; this.sql = sql; this.values = values;
  }
  bind(...values: unknown[]): NodeStatement { return new Statement(this.owner, this.sql, values.map(parameter)); }
  async execute<T>(client: Pick<PostgresClient, 'query'> = this.owner.pool): Promise<NodeResult<T>> {
    const value = await client.query(postgresSql(this.sql), this.values);
    return { success: true, results: value.rows as T[], meta: {
      changes: ['INSERT', 'UPDATE', 'DELETE', 'MERGE'].includes(value.command || '') ? (value.rowCount || 0) : 0,
      last_row_id: 0,
    } };
  }
  async first<T = NodeRow>(column?: string): Promise<T | null> {
    const row = (await this.execute<NodeRow>()).results[0];
    if (!row) return null;
    if (column !== undefined) {
      if (!Object.hasOwn(row, column)) throw new Error('Requested result column does not exist.');
      return row[column] as T;
    }
    return row as T;
  }
  all<T = NodeRow>(): Promise<NodeResult<T>> { return this.execute<T>(); }
  run<T = NodeRow>(): Promise<NodeResult<T>> { return this.execute<T>(); }
}

export class PostgresDatabase implements NodeDatabase {
  readonly path = 'postgresql';
  readonly pool: PostgresPool;
  constructor(pool: PostgresPool) { this.pool = pool; }
  prepare(sql: string): NodeStatement { return new Statement(this, sql); }
  async batch<T = NodeRow>(statements: NodeStatement[]): Promise<NodeResult<T>[]> {
    if (!statements.length) return [];
    if (statements.some((statement) => !(statement instanceof Statement) || statement.owner !== this)) {
      throw new TypeError('Every batch statement must belong to this database.');
    }
    for (let attempt = 0; ; attempt++) {
      const client = await this.pool.connect();
      let retry = false;
      try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        const results: NodeResult<T>[] = [];
        for (const statement of statements) results.push(await (statement as Statement).execute<T>(client));
        await client.query('COMMIT');
        return results;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* preserve the original failure */ }
        const code = (error as { code?: string }).code;
        retry = attempt < 5 && (code === '40001' || code === '40P01');
        if (!retry) throw error;
      } finally { client.release(); }
      if (retry) await new Promise((resolve) => setTimeout(resolve, 10 * 2 ** attempt + Math.floor(Math.random() * 15)));
    }
  }
  close(): Promise<void> { return this.pool.end(); }
}

export function openPostgresDatabase(options: PoolConfig = postgresPoolOptions()): PostgresDatabase {
  const pool = new Pool({ ...options, types: { getTypeParser(oid: number, format?: 'text' | 'binary') {
    if (oid === 20 && (!format || format === 'text')) return (value: string) => {
      const number = Number(value); return Number.isSafeInteger(number) ? number : value;
    };
    return types.getTypeParser(oid, format);
  } } });
  pool.on('error', () => console.error('PostgreSQL idle connection failed.'));
  return new PostgresDatabase(pool as unknown as PostgresPool);
}
