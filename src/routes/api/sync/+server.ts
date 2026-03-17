/// <reference types="@cloudflare/workers-types" />
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { upsertRows } from '$lib/server/sync-utils';
import { recalcTotals } from '$lib/server/totals';

// POST /api/sync - 全量上传
export const POST: RequestHandler = async ({ request, platform }) => {
  const accessKey = request.headers.get('x-access-key');
  const expected = ((platform as any)?.env as any)?.ACCESS_KEY as string | undefined;
  if (!expected || accessKey !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = ((platform as any)?.env as any)?.DB as D1Database;
  if (!db) return json({ ok: false, error: 'DB binding missing' }, { status: 500 });

  try {
    const body = await request.json() as any;
    const changes = body?.changes || {
      child: body.child ? [body.child] : [],
      task_template: body.tasks || body.task_template || [],
      reward_item: body.rewards || body.reward_item || [],
      penalty_rule: body.penalties || body.penalty_rule || [],
      transactions: body.transactions || []
    };

    await upsertRows(db, 'child', changes.child || [], (r) => ({ ...r, id: 'main' }), body.device_id);
    await upsertRows(db, 'task_template', changes.task_template || [], undefined, body.device_id);
    await upsertRows(db, 'reward_item', changes.reward_item || [], undefined, body.device_id);
    await upsertRows(db, 'penalty_rule', changes.penalty_rule || [], undefined, body.device_id);
    const txs = changes.transactions || [];
    const txChanged = await upsertRows(db, 'transactions', txs, (r) => ({ ...r, child_id: 'main' }), body.device_id);
    if (txChanged > 0) {
      await recalcTotals(db, 'main');
    }

    const cursorRow = await db.prepare('SELECT current AS v FROM version_seq').first<{ v: number }>();
    return json({ ok: true, synced: true, timestamp: Date.now(), server_cursor: Number(cursorRow?.v || 0) });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || 'sync error') }, { status: 500 });
  }
};

// GET /api/sync - 全量下载
export const GET: RequestHandler = async ({ url, platform, request }) => {
  const accessKey = request.headers.get('x-access-key');
  const expected = ((platform as any)?.env as any)?.ACCESS_KEY as string | undefined;
  if (!expected || accessKey !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = ((platform as any)?.env as any)?.DB as D1Database;
  if (!db) return json({ ok: false, error: 'DB binding missing' }, { status: 500 });

  const child_id = 'main';

  try {
    const child = await db.prepare('SELECT * FROM child WHERE id = ?').bind(child_id).first();

    const tasks = await db.prepare('SELECT * FROM task_template ORDER BY created_at').all();
    const rewards = await db.prepare('SELECT * FROM reward_item ORDER BY created_at').all();
    const penalties = await db.prepare('SELECT * FROM penalty_rule ORDER BY created_at').all();

    const transactions = await db.prepare(
      'SELECT * FROM transactions WHERE child_id = ? ORDER BY created_at DESC LIMIT 500'
    ).bind(child_id).all();

    return json({
      ok: true,
      data: {
        child: child || null,
        tasks: tasks.results || [],
        rewards: rewards.results || [],
        penalties: penalties.results || [],
        transactions: transactions.results || []
      }
    });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || 'fetch error') }, { status: 500 });
  }
};
