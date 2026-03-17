-- Add metadata for totals incremental sync and index for reverse lookup

CREATE TABLE IF NOT EXISTS sync_meta (
  id TEXT PRIMARY KEY,
  last_cursor INTEGER NOT NULL DEFAULT 0,
  last_recalc_at TEXT
);

INSERT INTO sync_meta(id, last_cursor)
SELECT 'totals', 0
WHERE NOT EXISTS (SELECT 1 FROM sync_meta WHERE id = 'totals');

CREATE INDEX IF NOT EXISTS idx_tx_ref_id ON transactions(ref_id);
