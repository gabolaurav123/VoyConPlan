declare namespace NodeJS {
  interface ProcessEnv {
    /** Absolute SQLite file path under the attached persistent volume. */
    DATABASE_PATH?: string;
  }
}
