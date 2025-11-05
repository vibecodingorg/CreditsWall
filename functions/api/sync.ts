/// <reference types="@cloudflare/workers-types" />

/**
 * POST /api/sync
 * 全量同步：上传所有本地数据到服务器
 */
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = (env as any).DB as D1Database;
  const data = await request.json() as {
    child?: any;
    tasks?: any[];
    rewards?: any[];
    penalties?: any[];
    transactions?: any[];
  };

  try {
    // 1. 同步 child
    if (data.child) {
      await db.prepare(
        `INSERT OR REPLACE INTO child (id, name, avatar, color, total_earned, total_spent, total_penalty, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        data.child.id,
        data.child.name,
        data.child.avatar ?? null,
        data.child.color ?? null,
        data.child.total_earned ?? 0,
        data.child.total_spent ?? 0,
        data.child.total_penalty ?? 0,
        data.child.created_at
      ).run();
    }

    // 2. 同步 tasks
    if (data.tasks && data.tasks.length > 0) {
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

    // 3. 同步 rewards
    if (data.rewards && data.rewards.length > 0) {
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

    // 4. 同步 penalties
    if (data.penalties && data.penalties.length > 0) {
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

    // 5. 同步 transactions
    if (data.transactions && data.transactions.length > 0) {
      for (const tx of data.transactions) {
        try {
          await db.prepare(
            `INSERT OR IGNORE INTO transaction (
              id, child_id, type, points, ref_id, idempotency_key, 
              created_at, created_by, rule_id, calc_basis, calc_snapshot, 
              reason_id, reason_code, reason_category, tags, notes,
              reversed, reversed_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            tx.id,
            tx.child_id,
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
        } catch (e) {
          // 忽略重复记录错误
          console.error('Transaction insert error:', e);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, synced: true, timestamp: Date.now() }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || 'sync error') }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
};

/**
 * GET /api/sync?child_id=xxx
 * 下载所有服务器数据
 */
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const child_id = url.searchParams.get('child_id');
  const db = (env as any).DB as D1Database;

  try {
    // 获取 child
    const child = child_id 
      ? await db.prepare('SELECT * FROM child WHERE id = ?').bind(child_id).first()
      : await db.prepare('SELECT * FROM child LIMIT 1').first();

    // 获取所有模板和规则
    const tasks = await db.prepare('SELECT * FROM task_template ORDER BY created_at').all();
    const rewards = await db.prepare('SELECT * FROM reward_item ORDER BY created_at').all();
    const penalties = await db.prepare('SELECT * FROM penalty_rule ORDER BY created_at').all();
    
    // 获取交易记录
    const transactions = child
      ? await db.prepare(
          'SELECT * FROM transaction WHERE child_id = ? ORDER BY created_at DESC LIMIT 500'
        ).bind(child.id).all()
      : { results: [] };

    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          child: child || null,
          tasks: tasks.results || [],
          rewards: rewards.results || [],
          penalties: penalties.results || [],
          transactions: transactions.results || []
        }
      }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || 'fetch error') }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
};
