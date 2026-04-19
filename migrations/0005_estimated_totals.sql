CREATE TABLE estimated_totals (
  build_key        TEXT PRIMARY KEY,
  total_cents      INTEGER NOT NULL,
  hub_subtotal     INTEGER NOT NULL,
  sensor_subtotal  INTEGER NOT NULL,
  sensor_qty       INTEGER NOT NULL,
  computed_at      TEXT NOT NULL
);
