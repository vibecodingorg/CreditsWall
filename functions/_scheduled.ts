/// <reference types="@cloudflare/workers-types" />
import { recalcTotals } from './_lib/totals';

export async function onScheduled(_event: ScheduledEvent, env: Record<string, any>, ctx: ExecutionContext) {
  const db = env?.DB as D1Database | undefined;
  if (!db) return;
  ctx.waitUntil(recalcTotals(db, 'main'));
}

// Support worker-style scheduled handler if runtime expects it
export async function scheduled(event: ScheduledEvent, env: Record<string, any>, ctx: ExecutionContext) {
  return onScheduled(event, env, ctx);
}
