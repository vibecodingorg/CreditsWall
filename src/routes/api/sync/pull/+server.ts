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

export const GET: RequestHandler = async ({ platform, request, url }) => {
  const accessKey = request.headers.get('x-access-key');
  const expected = ((platform as any)?.env as any)?.ACCESS_KEY as string | undefined;
  if (!expected || accessKey !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = ((platform as any)?.env as any)?.DB as D1Database;
  if (!db) return json({ ok: false, error: 'DB binding missing' }, { status: 500 });

  const cursor = Number(url.searchParams.get('cursor') || 0);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 500), 2000));

  try {
    const where = 'WHERE server_version > ?';
    const order = 'ORDER BY server_version ASC';
    const lim = `LIMIT ${limit}`;

    const child = await db.prepare(`SELECT * FROM child ${where} ${order} ${lim}`).bind(cursor).all();
    const tasks = await db.prepare(`SELECT * FROM task_template ${where} ${order} ${lim}`).bind(cursor).all();
    const rewards = await db.prepare(`SELECT * FROM reward_item ${where} ${order} ${lim}`).bind(cursor).all();
    const penalties = await db.prepare(`SELECT * FROM penalty_rule ${where} ${order} ${lim}`).bind(cursor).all();
    const transactions = await db.prepare(`SELECT * FROM transactions ${where} ${order} ${lim}`).bind(cursor).all();

    const newCursor = await getCurrentCursor(db);

    return json({
      ok: true,
      cursor: newCursor,
      changes: {
        child: child.results || [],
        task_template: tasks.results || [],
        reward_item: rewards.results || [],
        penalty_rule: penalties.results || [],
        transactions: transactions.results || []
      }
    });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || 'pull error') }, { status: 500 });
  }
};
