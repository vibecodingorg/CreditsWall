/// <reference types="@cloudflare/workers-types" />
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

async function getCurrentCursor(db: D1Database): Promise<number> {
  try {
    const v = await db.prepare('SELECT current AS v FROM version_seq').first<{ v: number }>();
    if (v && typeof v.v === 'number') return v.v;
  } catch {}
  const tables = ['child','task_template','reward_item','penalty_rule','transactions'];
  let maxv = 0;
  for (const t of tables) {
    try {
      const r = await db.prepare(`SELECT COALESCE(MAX(server_version),0) AS v FROM ${t}`).first<{ v: number }>();
      maxv = Math.max(maxv, Number(r?.v || 0));
    } catch {}
  }
  return maxv;
}

export const GET: RequestHandler = async ({ platform, request }) => {
  const accessKey = request.headers.get('x-access-key');
  const expected = ((platform as any)?.env as any)?.ACCESS_KEY as string | undefined;
  if (!expected || accessKey !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = ((platform as any)?.env as any)?.DB as D1Database;
  if (!db) return json({ ok: false, error: 'DB binding missing' }, { status: 500 });

  try {
    const child = await db.prepare('SELECT * FROM child WHERE id = ?').bind('main').first();
    const tasks = await db.prepare('SELECT * FROM task_template').all();
    const rewards = await db.prepare('SELECT * FROM reward_item').all();
    const penalties = await db.prepare('SELECT * FROM penalty_rule').all();
    const transactions = await db.prepare('SELECT * FROM transactions WHERE child_id = ? ORDER BY created_at DESC LIMIT 5000').bind('main').all();

    const cursor = await getCurrentCursor(db);

    return json({
      ok: true,
      cursor,
      data: {
        child: child || null,
        task_template: tasks.results || [],
        reward_item: rewards.results || [],
        penalty_rule: penalties.results || [],
        transactions: transactions.results || []
      }
    });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || 'bootstrap error') }, { status: 500 });
  }
};
