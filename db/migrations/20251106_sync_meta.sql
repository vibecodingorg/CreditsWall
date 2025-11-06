-- P1: Add sync metadata columns and version sequence for incremental sync
-- Run this against your D1 database before enabling /api/bootstrap and /api/sync/pull

-- NOTE: D1/SQLite does not allow non-constant DEFAULT expressions on ALTER TABLE
ALTER TABLE child ADD COLUMN updated_at TEXT;
ALTER TABLE child ADD COLUMN deleted_at TEXT;
ALTER TABLE child ADD COLUMN server_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE child ADD COLUMN last_editor TEXT;
UPDATE child SET updated_at = COALESCE(updated_at, datetime('now')) WHERE updated_at IS NULL;

ALTER TABLE task_template ADD COLUMN updated_at TEXT;
ALTER TABLE task_template ADD COLUMN deleted_at TEXT;
ALTER TABLE task_template ADD COLUMN server_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE task_template ADD COLUMN last_editor TEXT;
UPDATE task_template SET updated_at = COALESCE(updated_at, datetime('now')) WHERE updated_at IS NULL;

ALTER TABLE reward_item ADD COLUMN updated_at TEXT;
ALTER TABLE reward_item ADD COLUMN deleted_at TEXT;
ALTER TABLE reward_item ADD COLUMN server_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reward_item ADD COLUMN last_editor TEXT;
UPDATE reward_item SET updated_at = COALESCE(updated_at, datetime('now')) WHERE updated_at IS NULL;

ALTER TABLE penalty_rule ADD COLUMN updated_at TEXT;
ALTER TABLE penalty_rule ADD COLUMN deleted_at TEXT;
ALTER TABLE penalty_rule ADD COLUMN server_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE penalty_rule ADD COLUMN last_editor TEXT;
UPDATE penalty_rule SET updated_at = COALESCE(updated_at, datetime('now')) WHERE updated_at IS NULL;

ALTER TABLE transactions ADD COLUMN updated_at TEXT;
ALTER TABLE transactions ADD COLUMN deleted_at TEXT;
ALTER TABLE transactions ADD COLUMN server_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN last_editor TEXT;
UPDATE transactions SET updated_at = COALESCE(updated_at, datetime('now')) WHERE updated_at IS NULL;

-- global version sequence (single row table)
CREATE TABLE IF NOT EXISTS version_seq (
  current INTEGER NOT NULL DEFAULT 0
);

-- initialize if empty
INSERT INTO version_seq(current)
SELECT 1000 WHERE NOT EXISTS (SELECT 1 FROM version_seq);
