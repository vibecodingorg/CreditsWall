/// <reference types="@cloudflare/workers-types" />
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const child_id = url.searchParams.get('child_id');
  const db = (env as any).DB as D1Database;
  let q = `SELECT * FROM transactions`;
  const params: any[] = [];
  if (child_id) { q += ` WHERE child_id = ?`; params.push(child_id); }
  q += ` ORDER BY datetime(created_at) DESC LIMIT 200`;
  const rs = await db.prepare(q).bind(...params).all();
  return new Response(JSON.stringify({ items: rs.results || [] }), { headers: { 'content-type': 'application/json' } });
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = (env as any).DB as D1Database;
  const tx = (await request.json()) as any;
  try {
    await db.prepare(
      `INSERT INTO transactions (id, child_id, type, points, ref_id, idempotency_key, created_at, created_by, rule_id, calc_basis, calc_snapshot, reason_id, reason_code, reason_category, tags, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      tx.notes ?? null
    ).run();
    return new Response(JSON.stringify({ ok: true, server_version: Date.now() }), { headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    const msg = String(e?.message || 'error');
    if (msg.includes('UNIQUE') && msg.includes('idempotency_key')) {
      return new Response(JSON.stringify({ ok: true, duplicate: true, server_version: Date.now() }), { headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
};
