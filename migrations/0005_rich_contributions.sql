CREATE TABLE contributions_next (
  id TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  restaurant_id TEXT REFERENCES restaurants(id) ON DELETE SET NULL,
  restaurant_name TEXT NOT NULL,
  window_name TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  image_id TEXT REFERENCES images(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  published_id TEXT,
  mode TEXT NOT NULL DEFAULT 'legacy' CHECK(mode IN ('legacy','restaurant','update')),
  include_main INTEGER NOT NULL DEFAULT 1,
  name_zh_hant TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  address_zh_hant TEXT NOT NULL DEFAULT '',
  address_en TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '其他',
  description TEXT NOT NULL DEFAULT '',
  description_zh_hant TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  opens_app INTEGER NOT NULL DEFAULT 0,
  wechat_mini_program INTEGER NOT NULL DEFAULT 0,
  other_note TEXT NOT NULL DEFAULT '',
  other_note_zh_hant TEXT NOT NULL DEFAULT '',
  other_note_en TEXT NOT NULL DEFAULT ''
);
INSERT INTO contributions_next(id,browser_hash,restaurant_id,restaurant_name,window_name,url,image_id,status,created_at,reviewed_at,published_id)
SELECT id,browser_hash,restaurant_id,restaurant_name,window_name,url,image_id,status,created_at,reviewed_at,published_id FROM contributions;
DROP TABLE contributions;
ALTER TABLE contributions_next RENAME TO contributions;
CREATE INDEX contributions_status ON contributions(status, created_at DESC);
CREATE INDEX contributions_browser ON contributions(browser_hash, created_at DESC);

CREATE TABLE contribution_windows (
  id TEXT PRIMARY KEY,
  contribution_id TEXT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  image_id TEXT REFERENCES images(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  included INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX contribution_windows_parent ON contribution_windows(contribution_id, sort_order);

ALTER TABLE restaurants ADD COLUMN opens_app INTEGER NOT NULL DEFAULT 0;
ALTER TABLE restaurants ADD COLUMN wechat_mini_program INTEGER NOT NULL DEFAULT 0;
ALTER TABLE restaurants ADD COLUMN other_note TEXT NOT NULL DEFAULT '';
ALTER TABLE restaurants ADD COLUMN other_note_zh_hant TEXT NOT NULL DEFAULT '';
ALTER TABLE restaurants ADD COLUMN other_note_en TEXT NOT NULL DEFAULT '';
