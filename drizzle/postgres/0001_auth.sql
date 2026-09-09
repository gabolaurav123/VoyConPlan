CREATE TABLE auth_accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE CHECK(email=lower(email)), password_hash TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN (0,1)), created_at TEXT NOT NULL
);
CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL
);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE auth_bootstrap (id INTEGER PRIMARY KEY CHECK(id=1), claimed_at TEXT NOT NULL);
CREATE TABLE auth_rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at BIGINT NOT NULL);
CREATE INDEX idx_auth_rate_limits_expiry ON auth_rate_limits(expires_at);
