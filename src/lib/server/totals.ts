/// <reference types="@cloudflare/workers-types" />

type Totals = { earned: number; spent: number; penalty: number };

const EARN_TYPES = ['task_complete', 'issue', 'adjust'];

async function ensureMetaRow(db: D1Database) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS sync_meta (
      id TEXT PRIMARY KEY,
      last_cursor INTEGER NOT NULL DEFAULT 0,
      last_recalc_at TEXT
    )`
  ).run();
  await db.prepare(
    `INSERT INTO sync_meta(id, last_cursor)
     SELECT 'totals', 0
     WHERE NOT EXISTS (SELECT 1 FROM sync_meta WHERE id = 'totals')`
  ).run();
}

async function getMeta(db: D1Database): Promise<{ last_cursor: number; last_recalc_at?: string | null }> {
  await ensureMetaRow(db);
  const row = await db.prepare(
    `SELECT last_cursor, last_recalc_at FROM sync_meta WHERE id = 'totals'`
  ).first<{ last_cursor: number; last_recalc_at?: string | null }>();
  return { last_cursor: Number(row?.last_cursor || 0), last_recalc_at: row?.last_recalc_at ?? null };
}

async function setMeta(db: D1Database, cursor: number, recalcAt?: string | null) {
  await ensureMetaRow(db);
  await db.prepare(
    `UPDATE sync_meta SET last_cursor = ?, last_recalc_at = COALESCE(?, last_recalc_at) WHERE id = 'totals'`
  ).bind(cursor, recalcAt ?? null).run();
}

async function nextVersion(db: D1Database): Promise<number> {
  await db.prepare('UPDATE version_seq SET current = current + 1').run();
  const row = await db.prepare('SELECT current AS v FROM version_seq').first<{ v: number }>();
  return Number(row?.v || 0);
}

function applyDeltaFromTx(totals: Totals, type: string, points: number, sign: 1 | -1) {
  if (EARN_TYPES.includes(type)) {
    totals.earned += sign * points;
  } else if (type === 'spend') totals.spent += sign * Math.abs(points);
  else if (type === 'penalty') totals.penalty += sign * Math.abs(points);
}

async function computeTotalsUpTo(db: D1Database, childId: string, cursor: number): Promise<Totals> {
  const base = await db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN type IN ('task_complete','issue','adjust') THEN points ELSE 0 END), 0) AS earned,
       COALESCE(SUM(CASE WHEN type = 'spend' THEN -points ELSE 0 END), 0) AS spent,
       COALESCE(SUM(CASE WHEN type = 'penalty' THEN -points ELSE 0 END), 0) AS penalty
     FROM transactions
     WHERE child_id = ?
       AND deleted_at IS NULL
       AND type != 'reverse'
       AND server_version <= ?`
  ).bind(childId, cursor).first<{ earned: number; spent: number; penalty: number }>();

  const adj = await db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN o.type IN ('task_complete','issue','adjust') THEN -o.points ELSE 0 END), 0) AS earned,
       COALESCE(SUM(CASE WHEN o.type = 'spend' THEN -ABS(o.points) ELSE 0 END), 0) AS spent,
       COALESCE(SUM(CASE WHEN o.type = 'penalty' THEN -ABS(o.points) ELSE 0 END), 0) AS penalty
     FROM transactions r
     JOIN transactions o ON o.id = r.ref_id
     WHERE r.child_id = ?
       AND r.deleted_at IS NULL
       AND r.type = 'reverse'
       AND r.server_version <= ?`
  ).bind(childId, cursor).first<{ earned: number; spent: number; penalty: number }>();

  return {
    earned: Number(base?.earned || 0) + Number(adj?.earned || 0),
    spent: Number(base?.spent || 0) + Number(adj?.spent || 0),
    penalty: Number(base?.penalty || 0) + Number(adj?.penalty || 0)
  };
}

export async function recalcTotals(db: D1Database, childId = 'main'): Promise<number> {
  await ensureMetaRow(db);
  const cursorRow = await db.prepare('SELECT current AS v FROM version_seq').first<{ v: number }>();
  const cursor = Number(cursorRow?.v || 0);

  const totals = await computeTotalsUpTo(db, childId, cursor);
  const nowIso = new Date().toISOString();
  const ver = await nextVersion(db);
  await db.prepare(
    `UPDATE child
       SET total_earned = ?, total_spent = ?, total_penalty = ?, updated_at = ?, server_version = ?
     WHERE id = ?`
  ).bind(totals.earned, totals.spent, totals.penalty, nowIso, ver, childId).run();

  await setMeta(db, cursor, nowIso);
  return cursor;
}

export async function advanceTotals(db: D1Database, childId = 'main'): Promise<number> {
  const meta = await getMeta(db);
  let cursor = meta.last_cursor;
  let maxCursor = cursor;
  const totalsRow = await db.prepare(
    `SELECT total_earned, total_spent, total_penalty FROM child WHERE id = ?`
  ).bind(childId).first<{ total_earned: number; total_spent: number; total_penalty: number }>();

  const totals: Totals = {
    earned: Number(totalsRow?.total_earned || 0),
    spent: Number(totalsRow?.total_spent || 0),
    penalty: Number(totalsRow?.total_penalty || 0)
  };

  while (true) {
    const rows = await db.prepare(
      `SELECT id, ref_id, type, points, reversed, deleted_at, server_version, child_id
       FROM transactions
       WHERE server_version > ?
       ORDER BY server_version ASC
       LIMIT 500`
    ).bind(cursor).all<{ id: string; ref_id?: string; type: string; points: number; reversed?: number; deleted_at?: string; server_version: number; child_id: string }>();

    const list = rows.results || [];
    if (!list.length) break;

    for (const tx of list) {
      const ver = Number(tx.server_version || 0);
      if (ver > maxCursor) maxCursor = ver;
      if (tx.child_id !== childId) continue;
      if (tx.deleted_at) continue;

      if (tx.type === 'reverse') {
        if (!tx.ref_id) continue;
        const orig = await db.prepare(
          `SELECT type, points FROM transactions WHERE id = ?`
        ).bind(tx.ref_id).first<{ type: string; points: number }>();
        if (!orig) continue;
        applyDeltaFromTx(totals, orig.type, orig.points, -1);
        continue;
      }

      if (tx.reversed) {
        // updated original (reversed flag) should not change totals
        continue;
      }

      applyDeltaFromTx(totals, tx.type, tx.points, 1);
    }

    cursor = maxCursor;
  }

  if (maxCursor > meta.last_cursor) {
    const nowIso = new Date().toISOString();
    const ver = await nextVersion(db);
    await db.prepare(
      `UPDATE child
         SET total_earned = ?, total_spent = ?, total_penalty = ?, updated_at = ?, server_version = ?
       WHERE id = ?`
    ).bind(totals.earned, totals.spent, totals.penalty, nowIso, ver, childId).run();
    await setMeta(db, maxCursor, null);
  }

  return maxCursor;
}
