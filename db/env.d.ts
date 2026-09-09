declare namespace NodeJS {
  interface ProcessEnv {
    /** Local-development SQLite path only. Ignored in production. */
    DATABASE_PATH?: string;
    DATABASE_URL?: string;
    DATABASE_SSL_MODE?: 'verify-full' | 'disable';
    DATABASE_SSL_CA?: string;
    DATABASE_POOL_MAX?: string;
  }
}
