CREATE TABLE users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'Free', role TEXT NOT NULL DEFAULT 'user',
  suspended INTEGER NOT NULL DEFAULT 0, profile TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE INDEX idx_users_email ON users(email);
CREATE TABLE trips (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_trips_owner ON trips(owner_id);
CREATE TABLE members (
  id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, preferences TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_members_trip ON members(trip_id);
CREATE INDEX idx_members_user ON members(user_id);
CREATE TABLE share_links (
  id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  hash TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0, claimed_by TEXT, created_at TEXT NOT NULL
);
CREATE TABLE destinations (id TEXT PRIMARY KEY, data TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0);
CREATE TABLE plans (id TEXT PRIMARY KEY, price INTEGER NOT NULL, trip_limit INTEGER NOT NULL, collaborators INTEGER NOT NULL, features TEXT NOT NULL);
CREATE TABLE usage (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE favorites (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, destination_id TEXT NOT NULL);
CREATE TABLE content (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  summary TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, owner_id TEXT, data TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX idx_records_kind ON records(kind);
CREATE INDEX idx_records_owner ON records(owner_id);
CREATE TABLE events (id TEXT PRIMARY KEY, name TEXT NOT NULL, session_id TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX idx_events_date ON events(created_at);
CREATE TABLE audit_log (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires BIGINT NOT NULL);
