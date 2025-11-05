/// <reference types="@cloudflare/workers-types" />

const SQL = `
CREATE TABLE IF NOT EXISTS child (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  color TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_template (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  points INTEGER NOT NULL,
  icon TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reward_item (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cost_points INTEGER NOT NULL,
  icon TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reason_catalog (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  is_preset INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS penalty_rule (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  mode TEXT NOT NULL,
  value INTEGER NOT NULL,
  basis TEXT,
  cap INTEGER,
  floor INTEGER,
  rounding TEXT,
  cooldown_sec INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  type TEXT NOT NULL,
  points INTEGER NOT NULL,
  ref_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  rule_id TEXT,
  calc_basis TEXT,
  calc_snapshot TEXT,
  reason_id TEXT,
  reason_code TEXT,
  reason_category TEXT,
  tags TEXT,
  notes TEXT,
  FOREIGN KEY(child_id) REFERENCES child(id)
);

CREATE INDEX IF NOT EXISTS idx_tx_child_time ON transactions(child_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_idem ON transactions(idempotency_key);
`;

export const onRequestPost: PagesFunction = async ({ env }) => {
  const db = (env as any).DB as D1Database;
  // D1 does not support executing multiple statements in one prepare, so split by ;
  const statements = SQL.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await db.prepare(stmt).run().catch((e) => {
      // ignore if statement not applicable
    });
  }
  return new Response(JSON.stringify({ ok: true, statements: statements.length }), {
    headers: { 'content-type': 'application/json' }
  });
};
