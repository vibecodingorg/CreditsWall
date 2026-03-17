/// <reference types="@cloudflare/workers-types" />
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { upsertRows } from '$lib/server/sync-utils';
import { advanceTotals } from '$lib/server/totals';

type ChangesPayload = {
  child?: any[];
  task_template?: any[];
  reward_item?: any[];
  penalty_rule?: any[];
  transactions?: any[];
  device_id?: string;
};


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
    const txChanged = await upsertRows(db, 'transactions', txs, (r) => ({ ...r, child_id: 'main' }), body.device_id);
    if (txChanged > 0) {
      await advanceTotals(db, 'main');
    }

    const cursorRow = await db.prepare('SELECT current AS v FROM version_seq').first<{ v: number }>();
    return json({ ok: true, server_cursor: Number(cursorRow?.v || 0) });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || 'push error') }, { status: 500 });
  }
};
