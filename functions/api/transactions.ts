/// <reference types="@cloudflare/workers-types" />
import { advanceTotals } from '../_lib/totals';

/**
 * GET /api/transactions?child_id=xxx
 * 获取交易记录列表
 */
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const accessKey = request.headers.get('x-access-key');
  const expected = (env as any)?.ACCESS_KEY as string | undefined;
  if (!expected || accessKey !== expected) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }
  const url = new URL(request.url);
  const child_id = url.searchParams.get('child_id');
  const db = (env as any).DB as D1Database;
  
  let q = `SELECT * FROM transactions`;
  const params: any[] = [];
  if (child_id) { 
    q += ` WHERE child_id = ?`; 
    params.push(child_id); 
  }
  q += ` ORDER BY datetime(created_at) DESC LIMIT 200`;
  
  const rs = await db.prepare(q).bind(...params).all();
  return new Response(
    JSON.stringify({ items: rs.results || [] }), 
    { headers: { 'content-type': 'application/json' } }
  );
};

/**
 * POST /api/transactions
 * 创建新的交易记录
 */
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const accessKey = request.headers.get('x-access-key');
  const expected = (env as any)?.ACCESS_KEY as string | undefined;
  if (!expected || accessKey !== expected) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }
  const db = (env as any).DB as D1Database;
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
    
    if (tx.type === 'reverse' && tx.ref_id) {
      await db.prepare(
        `UPDATE transactions SET reversed = 1, reversed_by = ?, updated_at = ?, server_version = ? WHERE id = ?`
      ).bind(tx.id, new Date().toISOString(), await nextVersion(db), tx.ref_id).run();
    }

    await advanceTotals(db, 'main');
    
    return new Response(
      JSON.stringify({ ok: true, server_version: ver }), 
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (e: any) {
    const msg = String(e?.message || 'error');
    if (msg.includes('UNIQUE') && msg.includes('idempotency_key')) {
      let existingVer = 0;
      try {
        const row = await db.prepare(
          'SELECT server_version AS v FROM transactions WHERE idempotency_key = ?'
        ).bind(tx.idempotency_key).first<{ v: number }>();
        existingVer = Number(row?.v || 0);
      } catch {}
      return new Response(
        JSON.stringify({ ok: true, duplicate: true, server_version: existingVer }), 
        { headers: { 'content-type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ ok: false, error: msg }), 
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }
};

/**
 * 更新 child 统计字段
 */
// totals are recalculated incrementally via advanceTotals

async function nextVersion(db: D1Database): Promise<number> {
  try {
    await db.prepare('UPDATE version_seq SET current = current + 1').run();
    const row = await db.prepare('SELECT current AS v FROM version_seq').first<{ v: number }>();
    return Number(row?.v || 0);
  } catch {
    return Date.now();
  }
}
