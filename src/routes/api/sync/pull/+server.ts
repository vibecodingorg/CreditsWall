/// <reference types="@cloudflare/workers-types" />
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

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

    const rows = {
      child: child.results || [],
      task_template: tasks.results || [],
      reward_item: rewards.results || [],
      penalty_rule: penalties.results || [],
      transactions: transactions.results || []
    };

    let maxSeen = cursor;
    let minLimited: number | null = null;
    let hasMore = false;
    const takeLastVer = (arr: any[]) => Number(arr[arr.length - 1]?.server_version || 0);

    for (const key of Object.keys(rows) as (keyof typeof rows)[]) {
      const arr = rows[key];
      if (arr.length > 0) {
        maxSeen = Math.max(maxSeen, takeLastVer(arr));
      }
      if (arr.length === limit) {
        hasMore = true;
        const lastVer = takeLastVer(arr);
        minLimited = minLimited === null ? lastVer : Math.min(minLimited, lastVer);
      }
    }

    const nextCursor = hasMore && minLimited !== null ? Math.max(cursor, minLimited) : maxSeen;

    return json({
      ok: true,
      cursor: nextCursor,
      has_more: hasMore,
      changes: rows
    });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || 'pull error') }, { status: 500 });
  }
};
