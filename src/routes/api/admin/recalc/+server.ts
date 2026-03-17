/// <reference types="@cloudflare/workers-types" />
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { recalcTotals } from '$lib/server/totals';

export const POST: RequestHandler = async ({ platform, request }) => {
  const accessKey = request.headers.get('x-access-key');
  const expected = ((platform as any)?.env as any)?.ACCESS_KEY as string | undefined;
  if (!expected || accessKey !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = ((platform as any)?.env as any)?.DB as D1Database;
  if (!db) return json({ ok: false, error: 'DB binding missing' }, { status: 500 });

  try {
    const cursor = await recalcTotals(db, 'main');
    return json({ ok: true, cursor });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || 'recalc error') }, { status: 500 });
  }
};
