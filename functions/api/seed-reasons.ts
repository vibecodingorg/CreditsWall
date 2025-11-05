/// <reference types="@cloudflare/workers-types" />

const defaults = [
  { code: 'study.homework', title: '作业', category: 'study' },
  { code: 'health.brushing', title: '刷牙', category: 'health' },
  { code: 'discipline.punctual', title: '守时', category: 'discipline' },
  { code: 'chores.cleanroom', title: '整理房间', category: 'chores' },
  { code: 'discipline.misbehavior', title: '不遵守规则', category: 'discipline' },
  { code: 'study.homework_missing', title: '作业未完成', category: 'study' },
  { code: 'health.too_much_screen', title: '屏幕时间过长', category: 'health' }
];

export const onRequestPost: PagesFunction = async ({ env }) => {
  const db = (env as any).DB as D1Database;
  let inserted = 0;
  for (const r of defaults) {
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    await db
      .prepare(
        `INSERT OR IGNORE INTO reason_catalog (id, code, title, category, is_preset, active, created_at)
         VALUES (?, ?, ?, ?, 1, 1, ?)`
      )
      .bind(id, r.code, r.title, r.category, created_at)
      .run();
    inserted++;
  }
  return new Response(JSON.stringify({ ok: true, inserted }), { headers: { 'content-type': 'application/json' } });
};
