/// <reference types="@cloudflare/workers-types" />
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

// POST /api/sync - 全量上传
export const POST: RequestHandler = async ({ request, platform }) => {
  const accessKey = request.headers.get('x-access-key');
  const expected = ((platform as any)?.env as any)?.ACCESS_KEY as string | undefined;
  if (!expected || accessKey !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const db = ((platform as any)?.env as any)?.DB as D1Database;
  if (!db) return json({ ok: false, error: 'DB binding missing' }, { status: 500 });

  const data = await request.json() as {
    child?: any;
    tasks?: any[];
    rewards?: any[];
    penalties?: any[];
    transactions?: any[];
  };

  try {
    if (data.child) {
      // 强制单 child = 'main'
      const child = { ...data.child, id: 'main' };
      await db.prepare(
        `INSERT OR REPLACE INTO child (id, name, avatar, color, total_earned, total_spent, total_penalty, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        child.id,
        child.name,
        child.avatar ?? null,
        child.color ?? null,
        child.total_earned ?? 0,
        child.total_spent ?? 0,
        child.total_penalty ?? 0,
        child.created_at
      ).run();
    }

    if (data.tasks?.length) {
      for (const task of data.tasks) {
        await db.prepare(
          `INSERT OR REPLACE INTO task_template (id, title, points, icon, type, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          task.id,
          task.title,
          task.points,
          task.icon ?? null,
          task.type ?? 'daily',
          task.active ?? 1,
          task.created_at
        ).run();
      }
    }

    if (data.rewards?.length) {
      for (const reward of data.rewards) {
        await db.prepare(
          `INSERT OR REPLACE INTO reward_item (id, title, cost_points, icon, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          reward.id,
          reward.title,
          reward.cost_points,
          reward.icon ?? null,
          reward.active ?? 1,
          reward.created_at
        ).run();
      }
    }

    if (data.penalties?.length) {
      for (const penalty of data.penalties) {
        await db.prepare(
          `INSERT OR REPLACE INTO penalty_rule (id, title, icon, mode, value, basis, cap, floor, rounding, cooldown_sec, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          penalty.id,
          penalty.title,
          penalty.icon ?? null,
          penalty.mode,
          penalty.value,
          penalty.basis ?? null,
          penalty.cap ?? null,
          penalty.floor ?? null,
          penalty.rounding ?? null,
          penalty.cooldown_sec ?? null,
          penalty.active ?? 1,
          penalty.created_at
        ).run();
      }
    }

    if (data.transactions?.length) {
      for (const tx of data.transactions) {
        try {
          await db.prepare(
            `INSERT OR IGNORE INTO transactions (
              id, child_id, type, points, ref_id, idempotency_key,
              created_at, created_by, rule_id, calc_basis, calc_snapshot,
              reason_id, reason_code, reason_category, tags, notes,
              reversed, reversed_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            tx.id,
            'main',
            tx.type,
            tx.points,
            tx.ref_id ?? null,
            tx.idempotency_key,
            tx.created_at,
            tx.created_by,
            tx.rule_id ?? null,
            tx.calc_basis ?? null,
            tx.calc_snapshot ? JSON.stringify(tx.calc_snapshot) : null,
            tx.reason_id ?? null,
            tx.reason_code ?? null,
            tx.reason_category ?? null,
            tx.tags ? JSON.stringify(tx.tags) : null,
            tx.notes ?? null,
            tx.reversed ? 1 : 0,
            tx.reversed_by ?? null
          ).run();
        } catch {
          // 忽略重复
        }
      }
    }

    return json({ ok: true, synced: true, timestamp: Date.now() });
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
