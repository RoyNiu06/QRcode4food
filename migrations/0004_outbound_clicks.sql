CREATE TABLE outbound_clicks (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  window_id TEXT REFERENCES windows(id) ON DELETE SET NULL,
  clicked_at INTEGER NOT NULL
);
CREATE INDEX outbound_clicks_time ON outbound_clicks(clicked_at, restaurant_id, window_id);
