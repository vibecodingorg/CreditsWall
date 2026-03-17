/// <reference types="@cloudflare/workers-types" />

export function sanitize(table: string, row: any): any {
  const common = ['id', 'updated_at', 'deleted_at', 'server_version', 'last_editor', 'created_at'];
  if (table === 'child') {
    // totals are derived from transactions; ignore client-provided totals
    const allow = [...common, 'name', 'avatar', 'color'];
    return Object.fromEntries(Object.entries(row).filter(([k]) => allow.includes(k)));
  }
  if (table === 'task_template') {
    const allow = [...common, 'title', 'points', 'icon', 'type', 'active'];
    return Object.fromEntries(Object.entries(row).filter(([k]) => allow.includes(k)));
  }
  if (table === 'reward_item') {
    const allow = [...common, 'title', 'cost_points', 'icon', 'active'];
    return Object.fromEntries(Object.entries(row).filter(([k]) => allow.includes(k)));
  }
  if (table === 'penalty_rule') {
    // 仅保留数据库存在的列
    const allow = [...common, 'title', 'icon', 'mode', 'value', 'basis', 'rounding', 'active'];
    return Object.fromEntries(Object.entries(row).filter(([k]) => allow.includes(k)));
  }
  if (table === 'transactions') {
    const allow = [...common, 'child_id', 'type', 'points', 'ref_id', 'idempotency_key', 'created_by', 'rule_id', 'calc_basis', 'calc_snapshot', 'reason_id', 'reason_code', 'reason_category', 'tags', 'notes', 'reversed', 'reversed_by'];
    const out: any = {};
    for (const [k, v] of Object.entries(row)) {
      if (!allow.includes(k)) continue;
      if (k === 'calc_snapshot' && v && typeof v !== 'string') out[k] = JSON.stringify(v);
      else if (k === 'tags' && Array.isArray(v)) out[k] = JSON.stringify(v);
      else out[k] = v;
    }
    return out;
  }
  return row;
}

export async function nextVersion(db: D1Database): Promise<number> {
  const r = await db.prepare('UPDATE version_seq SET current = current + 1 RETURNING current').run();
  // Cloudflare D1 returns meta not rows for UPDATE ... RETURNING. Use SELECT as a fallback.
  const row = await db.prepare('SELECT current AS v FROM version_seq').first<{ v: number }>();
  return Number(row?.v || (r?.results as any)?.[0]?.current || 0);
}

function normalizeCompareValue(v: any): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function sameBusinessData(a: any, b: any): boolean {
  const skip = new Set(['updated_at', 'server_version', 'last_editor']);
  const keys = new Set<string>();
  for (const k of Object.keys(a || {})) if (!skip.has(k)) keys.add(k);
  for (const k of Object.keys(b || {})) if (!skip.has(k)) keys.add(k);

  for (const key of keys) {
    const va = normalizeCompareValue((a || {})[key]);
    const vb = normalizeCompareValue((b || {})[key]);
    if (va !== vb) return false;
  }
  return true;
}

export async function upsertRows(
  db: D1Database,
  table: string,
  rows: any[],
  enforce?: (row: any) => any,
  device_id?: string
): Promise<number> {
  let changed = 0;
  for (const incoming of rows) {
    const row = sanitize(table, enforce ? enforce(incoming) : incoming);
    const pk = row.id;
    if (!pk) continue;
    const exist = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(pk).first<any>();
    const incomingUpdated = row.updated_at || new Date().toISOString();
    let shouldWrite = false;
    if (!exist) shouldWrite = true;
    else {
      const localUpdated = exist.updated_at || '';
      const incomingTs = new Date(incomingUpdated).getTime();
      const localTs = new Date(localUpdated).getTime();
      const incomingIsNewer = Number.isFinite(incomingTs) && Number.isFinite(localTs)
        ? incomingTs > localTs
        : incomingUpdated > localUpdated;

      if (incomingIsNewer && !sameBusinessData(row, exist)) {
        shouldWrite = true;
      }
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
    changed += 1;
  }
  return changed;
}
