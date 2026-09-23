CREATE TABLE windows (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  image_id TEXT REFERENCES images(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX windows_restaurant ON windows(restaurant_id, sort_order, created_at);

CREATE TABLE contributions (
  id TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  restaurant_id TEXT REFERENCES restaurants(id) ON DELETE SET NULL,
  restaurant_name TEXT NOT NULL,
  window_name TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  image_id TEXT NOT NULL REFERENCES images(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  published_id TEXT
);
CREATE INDEX contributions_status ON contributions(status, created_at DESC);
CREATE INDEX contributions_browser ON contributions(browser_hash, created_at DESC);

CREATE TABLE contribution_quotas (
  browser_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX contribution_quotas_expiry ON contribution_quotas(expires_at);
