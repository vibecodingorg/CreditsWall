/// <reference types="@cloudflare/workers-types" />
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, platform }) => {
  const accessKey = request.headers.get('x-access-key');
  const expected = ((platform as any)?.env as any)?.ACCESS_KEY as string | undefined;
  if (!expected || accessKey !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = ((platform as any)?.env as any)?.DB as D1Database;
  if (!db) return json({ ok: false, error: 'DB binding missing' }, { status: 500 });

  const body: any = await request.json().catch(() => ({}));
  const confirm: string = (body && typeof body.confirm === 'string') ? body.confirm : '';
  if (confirm !== 'RESET-ALL') {
    return json({ ok: false, error: "confirmation required: send { confirm: 'RESET-ALL' }" }, { status: 400 });
  }

  try {
    await db.batch([
      db.prepare('DELETE FROM transactions'),
      db.prepare('DELETE FROM task_template'),
      db.prepare('DELETE FROM reward_item'),
      db.prepare('DELETE FROM penalty_rule'),
      db.prepare('DELETE FROM reason_catalog'),
      db.prepare('DELETE FROM child'),
      db.prepare('UPDATE version_seq SET current = 0')
    ]);
    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || 'reset error') }, { status: 500 });
  }
};
