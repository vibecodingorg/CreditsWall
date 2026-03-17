/// <reference types="@cloudflare/workers-types" />
import { recalcTotals } from '../../_lib/totals';

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const accessKey = request.headers.get('x-access-key');
  const expected = (env as any)?.ACCESS_KEY as string | undefined;
  if (!expected || accessKey !== expected) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }
  const db = (env as any).DB as D1Database;

  try {
    const cursor = await recalcTotals(db, 'main');
    return new Response(JSON.stringify({ ok: true, cursor }), { headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || 'recalc error') }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
};
