/// <reference types="@cloudflare/workers-types" />
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

function cutoffISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export const POST: RequestHandler = async ({ request, platform, url }) => {
  const accessKey = request.headers.get('x-access-key');
  const expected = ((platform as any)?.env as any)?.ACCESS_KEY as string | undefined;
  if (!expected || accessKey !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = ((platform as any)?.env as any)?.DB as D1Database;
  if (!db) return json({ ok: false, error: 'DB binding missing' }, { status: 500 });

  const days = Math.max(1, Math.min(Number(url.searchParams.get('days') || 90), 365));
  const cutoff = cutoffISO(days);

  try {
    const tables = ['task_template','reward_item','penalty_rule','transactions','child'];
    const results: Record<string, number> = {};
    for (const t of tables) {
      const res = await db
        .prepare(`DELETE FROM ${t} WHERE deleted_at IS NOT NULL AND updated_at < ?`)
        .bind(cutoff)
        .run();
      results[t] = Number((res.meta as any)?.rows_written || 0);
    }
    return json({ ok: true, results, cutoff, days });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || 'cleanup error') }, { status: 500 });
  }
};
