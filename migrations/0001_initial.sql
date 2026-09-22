CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT ''
);
INSERT INTO settings(id) VALUES(1);
CREATE TABLE admin (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  must_change INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  expires INTEGER NOT NULL,
  version INTEGER NOT NULL
);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 1,
  expires INTEGER NOT NULL
);
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '其他',
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  image_id TEXT REFERENCES images(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','disabled')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX restaurants_public ON restaurants(status, sort_order, created_at);
CREATE INDEX session_expiry ON sessions(expires);
