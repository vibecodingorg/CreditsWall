/// <reference types="@cloudflare/workers-types" />

/**
 * GET /api/transactions?child_id=xxx
 * 获取交易记录列表
 */
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const child_id = url.searchParams.get('child_id');
  const db = (env as any).DB as D1Database;
  
  let q = `SELECT * FROM transaction`;
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
  const db = (env as any).DB as D1Database;
  const tx = (await request.json()) as any;
  
  try {
    // 插入交易记录
    await db.prepare(
      `INSERT INTO transaction (
        id, child_id, type, points, ref_id, idempotency_key, 
        created_at, created_by, rule_id, calc_basis, calc_snapshot, 
        reason_id, reason_code, reason_category, tags, notes,
        reversed, reversed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      tx.reversed_by ?? null
    ).run();
    
    // 更新 child 统计
    await updateChildStats(db, tx);
    
    return new Response(
      JSON.stringify({ ok: true, server_version: Date.now() }), 
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (e: any) {
    const msg = String(e?.message || 'error');
    if (msg.includes('UNIQUE') && msg.includes('idempotency_key')) {
      return new Response(
        JSON.stringify({ ok: true, duplicate: true, server_version: Date.now() }), 
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
async function updateChildStats(db: D1Database, tx: any) {
  if (tx.type === 'task_complete') {
    // 任务完成：增加 total_earned
    await db.prepare(
      `UPDATE child SET total_earned = total_earned + ? WHERE id = ?`
    ).bind(Math.abs(tx.points), tx.child_id).run();
  } else if (tx.type === 'spend') {
    // 兑换消耗：增加 total_spent
    await db.prepare(
      `UPDATE child SET total_spent = total_spent + ? WHERE id = ?`
    ).bind(Math.abs(tx.points), tx.child_id).run();
  } else if (tx.type === 'penalty') {
    // 扣分：增加 total_penalty
    await db.prepare(
      `UPDATE child SET total_penalty = total_penalty + ? WHERE id = ?`
    ).bind(Math.abs(tx.points), tx.child_id).run();
  } else if (tx.type === 'reverse' && tx.ref_id) {
    // 撤销：反向调整统计
    const originalTx = await db.prepare(
      `SELECT type, points FROM transaction WHERE id = ?`
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
      
      // 标记原交易为已撤销
      await db.prepare(
        `UPDATE transaction SET reversed = 1, reversed_by = ? WHERE id = ?`
      ).bind(tx.id, tx.ref_id).run();
    }
  }
}
