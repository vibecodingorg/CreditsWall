/// <reference types="@cloudflare/workers-types" />
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

type ChangesPayload = {
  child?: any[];
  task_template?: any[];
  reward_item?: any[];
  penalty_rule?: any[];
  transactions?: any[];
  device_id?: string;
};

function sanitize(table: string, row: any): any {
  const common = ['id','updated_at','deleted_at','server_version','last_editor','created_at'];
  if (table === 'child') {
    const allow = [...common, 'name','avatar','color','total_earned','total_spent','total_penalty'];
    return Object.fromEntries(Object.entries(row).filter(([k]) => allow.includes(k)));
  }

async function recalcChildTotals(db: D1Database, childId: string) {
  // 依据 transactions 实表重算统计，保证权威一致
  const sums = await db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN type IN ('task_complete','issue','adjust') AND points > 0 THEN points ELSE 0 END), 0) AS earned,
       COALESCE(SUM(CASE WHEN type = 'spend' THEN -points ELSE 0 END), 0) AS spent,
       COALESCE(SUM(CASE WHEN type = 'penalty' THEN -points ELSE 0 END), 0) AS penalty
     FROM transactions WHERE child_id = ? AND deleted_at IS NULL`
  ).bind(childId).first<{ earned: number; spent: number; penalty: number }>();

  const nowIso = new Date().toISOString();
  const ver = await nextVersion(db);
  await db.prepare(
    `UPDATE child
       SET total_earned = ?, total_spent = ?, total_penalty = ?, updated_at = ?, server_version = ?
     WHERE id = ?`
  ).bind(Number(sums?.earned || 0), Number(sums?.spent || 0), Number(sums?.penalty || 0), nowIso, ver, childId).run();
}
  if (table === 'task_template') {
    const allow = [...common, 'title','points','icon','type','active'];
    return Object.fromEntries(Object.entries(row).filter(([k]) => allow.includes(k)));
  }
  if (table === 'reward_item') {
    const allow = [...common, 'title','cost_points','icon','active'];
    return Object.fromEntries(Object.entries(row).filter(([k]) => allow.includes(k)));
  }
  if (table === 'penalty_rule') {
    // 仅保留数据库存在的列
    const allow = [...common, 'title','icon','mode','value','basis','rounding','active'];
    return Object.fromEntries(Object.entries(row).filter(([k]) => allow.includes(k)));
  }
  if (table === 'transactions') {
    const allow = [...common, 'child_id','type','points','ref_id','idempotency_key','created_by','rule_id','calc_basis','calc_snapshot','reason_id','reason_code','reason_category','tags','notes','reversed','reversed_by'];
    const out: any = {};
    for (const [k,v] of Object.entries(row)) {
      if (!allow.includes(k)) continue;
      if (k === 'calc_snapshot' && v && typeof v !== 'string') out[k] = JSON.stringify(v);
      else if (k === 'tags' && Array.isArray(v)) out[k] = JSON.stringify(v);
      else out[k] = v;
    }
    return out;
  }
  return row;
}

async function nextVersion(db: D1Database): Promise<number> {
  const r = await db.prepare('UPDATE version_seq SET current = current + 1 RETURNING current').run();
  // Cloudflare D1 returns meta not rows for UPDATE ... RETURNING. Use SELECT as a fallback.
  const row = await db.prepare('SELECT current AS v FROM version_seq').first<{ v: number }>();
  return Number(row?.v || 0);
}

async function upsertRows(db: D1Database, table: string, rows: any[], enforce?: (row: any) => any, device_id?: string) {
  for (const incoming of rows) {
    const row = sanitize(table, enforce ? enforce(incoming) : incoming);
    const pk = row.id;
    if (!pk) continue;
    const exist = await db.prepare(`SELECT updated_at FROM ${table} WHERE id = ?`).bind(pk).first<{ updated_at?: string }>();
    const incomingUpdated = row.updated_at || new Date().toISOString();
    let shouldWrite = false;
    if (!exist) shouldWrite = true;
    else {
      const localUpdated = exist.updated_at || '';
      shouldWrite = new Date(incomingUpdated).getTime() > new Date(localUpdated).getTime();
    }
    if (!shouldWrite) continue;

    const ver = await nextVersion(db);
    const cols = Object.keys(row);
    const vals = cols.map(k => row[k]);
    const setCols = cols.map(k => `${k} = ?`).join(', ');

    // 服务端可信时间与编辑者
    const nowIso = new Date().toISOString();
    const updated_at = nowIso;
    const server_version = ver;
    const last_editor = device_id || row.last_editor || null;

    // Try update, if 0 rows then insert
    const updateSql = `UPDATE ${table} SET ${setCols}, updated_at = ?, server_version = ?, last_editor = ? WHERE id = ?`;
    const updateRes = await db.prepare(updateSql).bind(...vals, updated_at, server_version, last_editor, pk).run();
    if ((updateRes.meta as any)?.rows_written === 0) {
      const allCols = [...cols, 'updated_at', 'server_version', 'last_editor'];
      const qCols = allCols.join(', ');
      const qMarks = allCols.map(() => '?').join(', ');
      await db.prepare(`INSERT OR REPLACE INTO ${table} (${qCols}) VALUES (${qMarks})`)
        .bind(...vals, updated_at, server_version, last_editor)
        .run();
    }
  }
}

export const POST: RequestHandler = async ({ request, platform }) => {
  const accessKey = request.headers.get('x-access-key');
  const expected = ((platform as any)?.env as any)?.ACCESS_KEY as string | undefined;
  if (!expected || accessKey !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = ((platform as any)?.env as any)?.DB as D1Database;
  if (!db) return json({ ok: false, error: 'DB binding missing' }, { status: 500 });

  const body = (await request.json()) as { changes: ChangesPayload; device_id?: string };
  const changes = body?.changes || {};

  try {
    // enforce single child & transactions main child
    await upsertRows(db, 'child', changes.child || [], (r) => ({ ...r, id: 'main' }), body.device_id);
    await upsertRows(db, 'task_template', changes.task_template || [], undefined, body.device_id);
    await upsertRows(db, 'reward_item', changes.reward_item || [], undefined, body.device_id);
    await upsertRows(db, 'penalty_rule', changes.penalty_rule || [], undefined, body.device_id);
    const txs = changes.transactions || [];
    await upsertRows(db, 'transactions', txs, (r) => ({ ...r, child_id: 'main' }), body.device_id);
    if (txs.length > 0) {
      await recalcChildTotals(db, 'main');
    }

    const cursorRow = await db.prepare('SELECT current AS v FROM version_seq').first<{ v: number }>();
    return json({ ok: true, server_cursor: Number(cursorRow?.v || 0) });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || 'push error') }, { status: 500 });
  }
};
