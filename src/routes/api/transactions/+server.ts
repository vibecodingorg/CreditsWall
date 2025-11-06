async function nextVersion(db: D1Database): Promise<number> {
  try {
    await db.prepare('UPDATE version_seq SET current = current + 1').run();
    const row = await db.prepare('SELECT current AS v FROM version_seq').first<{ v: number }>();
    return Number(row?.v || 0);
  } catch {
    return Date.now();
  }
}
/// <reference types="@cloudflare/workers-types" />
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

// GET /api/transactions?child_id=xxx
export const GET: RequestHandler = async ({ url, platform, request }) => {
  const accessKey = request.headers.get('x-access-key');
  const expected = ((platform as any)?.env as any)?.ACCESS_KEY as string | undefined;
  if (!expected || accessKey !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const child_id = url.searchParams.get('child_id');
  const db = ((platform as any)?.env as any)?.DB as D1Database;
  if (!db) return json({ ok: false, error: 'DB binding missing' }, { status: 500 });

  let q = `SELECT * FROM transactions`;
  const params: any[] = [];
  if (child_id) {
    q += ` WHERE child_id = ?`;
    params.push(child_id);
  }
  q += ` ORDER BY datetime(created_at) DESC LIMIT 200`;

  const rs = await db.prepare(q).bind(...params).all();
  return json({ items: rs.results || [] });
};

// POST /api/transactions
export const POST: RequestHandler = async ({ request, platform }) => {
  const accessKey = request.headers.get('x-access-key');
  const expected = ((platform as any)?.env as any)?.ACCESS_KEY as string | undefined;
  if (!expected || accessKey !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = ((platform as any)?.env as any)?.DB as D1Database;
  if (!db) return json({ ok: false, error: 'DB binding missing' }, { status: 500 });

  const tx = (await request.json()) as any;
  // 单 child 强制为 'main'
  tx.child_id = 'main';

  try {
    const nowIso = new Date().toISOString();
    const ver = await nextVersion(db);
    // 确保 main child 存在（开发阶段允许自动创建）
    await db.prepare(
      `INSERT OR IGNORE INTO child (id, name, avatar, color, total_earned, total_spent, total_penalty, created_at)
       VALUES ('main', COALESCE((SELECT name FROM child WHERE id='main'),'孩子'), NULL, NULL, 0, 0, 0, COALESCE((SELECT created_at FROM child WHERE id='main'), datetime('now')))
      `
    ).run();

    // 插入交易记录
    await db.prepare(
      `INSERT INTO transactions (
        id, child_id, type, points, ref_id, idempotency_key,
        created_at, created_by, rule_id, calc_basis, calc_snapshot,
        reason_id, reason_code, reason_category, tags, notes,
        reversed, reversed_by,
        updated_at, server_version, last_editor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      tx.id,
      tx.child_id,
      tx.type,
      tx.points,
      tx.ref_id ?? null,
      tx.idempotency_key,
      tx.created_at,
      tx.created_by,
      tx.rule_id ?? null,
      tx.calc_basis ?? null,
      tx.calc_snapshot ? JSON.stringify(tx.calc_snapshot) : null,
      tx.reason_id ?? null,
      tx.reason_code ?? null,
      tx.reason_category ?? null,
      tx.tags ? JSON.stringify(tx.tags) : null,
      tx.notes ?? null,
      tx.reversed ? 1 : 0,
      tx.reversed_by ?? null,
      nowIso,
      ver,
      null
    ).run();

    await updateChildStats(db, tx);

    return json({ ok: true, server_version: Date.now() });
  } catch (e: any) {
    const msg = String(e?.message || 'error');
    if (msg.includes('UNIQUE') && msg.includes('idempotency_key')) {
      return json({ ok: true, duplicate: true, server_version: Date.now() });
    }
    return json({ ok: false, error: msg }, { status: 400 });
  }
};

async function updateChildStats(db: D1Database, tx: any) {
  if (tx.type === 'task_complete') {
    await db.prepare(
      `UPDATE child SET total_earned = total_earned + ? WHERE id = ?`
    ).bind(Math.abs(tx.points), tx.child_id).run();
  } else if (tx.type === 'spend') {
    await db.prepare(
      `UPDATE child SET total_spent = total_spent + ? WHERE id = ?`
    ).bind(Math.abs(tx.points), tx.child_id).run();
  } else if (tx.type === 'penalty') {
    await db.prepare(
      `UPDATE child SET total_penalty = total_penalty + ? WHERE id = ?`
    ).bind(Math.abs(tx.points), tx.child_id).run();
  } else if (tx.type === 'reverse' && tx.ref_id) {
    const originalTx = await db.prepare(
      `SELECT type, points FROM transactions WHERE id = ?`
    ).bind(tx.ref_id).first() as any;

    if (originalTx) {
      const absPoints = Math.abs(Number(originalTx.points));
      if (originalTx.type === 'task_complete') {
        await db.prepare(
          `UPDATE child SET total_earned = total_earned - ? WHERE id = ?`
        ).bind(absPoints, tx.child_id).run();
      } else if (originalTx.type === 'spend') {
        await db.prepare(
          `UPDATE child SET total_spent = total_spent - ? WHERE id = ?`
        ).bind(absPoints, tx.child_id).run();
      } else if (originalTx.type === 'penalty') {
        await db.prepare(
          `UPDATE child SET total_penalty = total_penalty - ? WHERE id = ?`
        ).bind(absPoints, tx.child_id).run();
      }
      await db.prepare(
        `UPDATE transactions SET reversed = 1, reversed_by = ? WHERE id = ?`
      ).bind(tx.id, tx.ref_id).run();
    }
  }
}
