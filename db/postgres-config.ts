import type { PoolConfig } from 'pg';

/** Never let URL sslmode silently replace the verified TLS configuration. */
export function postgresPoolOptions(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  let url: URL;
  try { url = new URL(env.DATABASE_URL || ''); }
  catch { throw new Error('DATABASE_URL must contain a valid PostgreSQL connection URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error('DATABASE_URL must use PostgreSQL and include a host and database name.');
  }
  const suppliedSslMode = url.searchParams.get('sslmode');
  const mode = env.DATABASE_SSL_MODE || (suppliedSslMode === 'disable' ? 'disable' : 'verify-full');
  if (!['verify-full', 'disable'].includes(mode)) throw new Error('DATABASE_SSL_MODE must be verify-full or disable.');
  for (const key of ['sslcert', 'sslkey', 'sslrootcert', 'sslmode', 'ssl', 'sslnegotiation']) url.searchParams.delete(key);
  const max = Number(env.DATABASE_POOL_MAX || 5);
  if (!Number.isInteger(max) || max < 1 || max > 20) throw new Error('DATABASE_POOL_MAX must be an integer between 1 and 20.');
  const ca = env.DATABASE_SSL_CA?.replace(/\\n/g, '\n');
  if (mode === 'disable' && ca) throw new Error('DATABASE_SSL_CA requires verified TLS.');
  return {
    connectionString: url.toString(),
    ssl: mode === 'disable' ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    max,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
    application_name: 'voyconplan',
  };
}
