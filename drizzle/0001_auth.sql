CREATE TABLE auth_accounts (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN (0,1)),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);
--> statement-breakpoint
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expires_at);
--> statement-breakpoint
CREATE TABLE auth_bootstrap (
  id INTEGER PRIMARY KEY NOT NULL CHECK(id=1),
  claimed_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE auth_rate_limits (
  id TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_auth_rate_limits_expiry ON auth_rate_limits(expires_at);
