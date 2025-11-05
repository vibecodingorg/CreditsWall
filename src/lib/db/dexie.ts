import Dexie, { type Table } from 'dexie';

export interface Child { id: string; name: string; avatar?: string; color?: string; total_earned?: number; total_spent?: number; total_penalty?: number; created_at: string }

export async function listTasks(): Promise<TaskTemplate[]> {
  return db.tasks.orderBy('created_at').toArray();
}

export async function addTask(input: { title: string; points: number; icon?: string; type?: 'single'|'daily' }): Promise<TaskTemplate> {
  const t: TaskTemplate = { id: crypto.randomUUID(), title: input.title, points: input.points, icon: input.icon, type: input.type || 'daily', active: 1, created_at: new Date().toISOString() };
  await db.tasks.add(t);
  return t;
}

export async function toggleTaskActive(id: string, active: boolean): Promise<void> {
  await db.tasks.update(id, { active: active ? 1 : 0 });
}

export async function deleteTask(id: string): Promise<void> {
  await db.tasks.delete(id);
}

export async function listRewards(): Promise<RewardItem[]> {
  return db.rewards.orderBy('created_at').toArray();
}

export async function addReward(input: { title: string; cost_points: number; icon?: string }): Promise<RewardItem> {
  const r: RewardItem = { id: crypto.randomUUID(), title: input.title, cost_points: input.cost_points, icon: input.icon, active: 1, created_at: new Date().toISOString() };
  await db.rewards.add(r);
  return r;
}

export async function toggleRewardActive(id: string, active: boolean): Promise<void> {
  await db.rewards.update(id, { active: active ? 1 : 0 });
}

export async function deleteReward(id: string): Promise<void> {
  await db.rewards.delete(id);
}

export async function listPenaltyRules(): Promise<PenaltyRule[]> {
  // @ts-ignore
  return (db as any).penalties?.orderBy('created_at').toArray() ?? [];
}

export async function addPenaltyRule(input: { title: string; icon?: string; mode: 'fixed'|'percent'; value: number; basis?: 'current_balance'|'today_earned'|'task_points'; rounding?: 'down'|'nearest'|'up' }): Promise<PenaltyRule> {
  const p: PenaltyRule = { id: crypto.randomUUID(), title: input.title, icon: input.icon, mode: input.mode, value: input.value, basis: input.basis, rounding: input.rounding, active: 1, created_at: new Date().toISOString() };
  // @ts-ignore
  await (db as any).penalties.add(p);
  return p;
}

export async function togglePenaltyRuleActive(id: string, active: boolean): Promise<void> {
  // @ts-ignore
  await (db as any).penalties.update(id, { active: active ? 1 : 0 });
}

export async function deletePenaltyRule(id: string): Promise<void> {
  // @ts-ignore
  await (db as any).penalties.delete(id);
}

export async function listChildren(): Promise<Child[]> {
  return db.children.orderBy('created_at').toArray();
}

export async function addChild(input: { name: string; color?: string; avatar?: string }): Promise<Child> {
  const child: Child = {
    id: crypto.randomUUID(),
    name: input.name,
    color: input.color,
    avatar: input.avatar,
    created_at: new Date().toISOString()
  };
  await db.children.add(child);
  return child;
}
export interface TaskTemplate { id: string; title: string; points: number; icon?: string; type?: 'single'|'daily'; active: number; created_at: string }
export interface RewardItem { id: string; title: string; cost_points: number; icon?: string; active: number; created_at: string }
export interface PenaltyRule { id: string; title: string; icon?: string; mode: 'fixed'|'percent'; value: number; basis?: 'current_balance'|'today_earned'|'task_points'; rounding?: 'down'|'nearest'|'up'; active: number; created_at: string }
export type TxType = 'issue' | 'spend' | 'reverse' | 'adjust' | 'task_complete' | 'penalty';
export interface Transaction {
  id: string; child_id: string; type: TxType; points: number; ref_id?: string;
  idempotency_key: string; created_at: string; created_by: 'local_device'|'parent'|'child';
  rule_id?: string; calc_basis?: 'current_balance'|'today_earned'|'task_points'; calc_snapshot?: any;
  reason_id?: string; reason_code?: string; reason_category?: string; tags?: string[]; notes?: string
  sync_status?: 'pending'|'synced'|'error'; server_version?: number;
  reversed?: boolean; reversed_by?: string; // 标记是否已撤销，以及撤销交易的ID
}
export interface ReasonCatalog { id: string; code: string; title: string; category: string; is_preset: number; active: number; created_at: string }

export class AppDB extends Dexie {
  children!: Table<Child, string>;
  tasks!: Table<TaskTemplate, string>;
  rewards!: Table<RewardItem, string>;
  transactions!: Table<Transaction, string>;
  reasons!: Table<ReasonCatalog, string>;

  constructor() {
    super('kids-points');
    this.version(1).stores({
      children: 'id, name, created_at',
      tasks: 'id, title, active, created_at',
      rewards: 'id, title, active, created_at',
      transactions: 'id, child_id, created_at, idempotency_key',
      reasons: 'id, code, category, is_preset, active'
    });
    this.version(2).stores({
      penalties: 'id, title, mode, value, basis, active, created_at'
    });
    // Add index for sync_status on transactions
    this.version(3).stores({
      transactions: 'id, child_id, created_at, idempotency_key, sync_status'
    }).upgrade(tx => {
      // backfill sync_status if missing
      return (tx as any).table('transactions').toCollection().modify((obj: any) => {
        if (!('sync_status' in obj)) obj.sync_status = 'synced';
      });
    });
  }
}

export const db = new AppDB();

export async function ensureDefaultChild(): Promise<Child> {
  const existing = await db.children.toCollection().first();
  if (existing) return existing;
  const child: Child = {
    id: crypto.randomUUID(),
    name: '小朋友',
    color: '#22c55e',
    total_earned: 0,
    total_spent: 0,
    total_penalty: 0,
    created_at: new Date().toISOString()
  };
  await db.children.add(child);
  return child;
}

// 获取孩子的统计信息
export async function getChildStats(childId: string): Promise<{ balance: number; totalEarned: number; totalSpent: number; totalPenalty: number }> {
  const child = await db.children.get(childId);
  if (!child) return { balance: 0, totalEarned: 0, totalSpent: 0, totalPenalty: 0 };
  
  const totalEarned = child.total_earned || 0;
  const totalSpent = child.total_spent || 0;
  const totalPenalty = child.total_penalty || 0;
  // 剩余积分 = 积分总额 - 已使用积分 - 扣分总额
  const balance = totalEarned - totalSpent - totalPenalty;
  
  return { balance, totalEarned, totalSpent, totalPenalty };
}

// 更新孩子的统计信息
export async function updateChildStats(childId: string, earnedDelta: number, spentDelta: number, penaltyDelta: number = 0): Promise<void> {
  const child = await db.children.get(childId);
  if (!child) return;
  
  const newEarned = (child.total_earned || 0) + earnedDelta;
  const newSpent = (child.total_spent || 0) + spentDelta;
  const newPenalty = (child.total_penalty || 0) + penaltyDelta;
  
  await db.children.update(childId, {
    total_earned: newEarned,
    total_spent: newSpent,
    total_penalty: newPenalty
  });
}

// 获取今日开始时间（本地时区0点）
function getTodayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// 获取今日已完成的任务ID列表
export async function getTodayCompletedTasks(childId: string): Promise<Set<string>> {
  const todayStart = getTodayStart().toISOString();
  const completions = await db.transactions
    .where('child_id').equals(childId)
    .and(tx => tx.type === 'task_complete' && tx.created_at >= todayStart)
    .toArray();
  
  return new Set(completions.map(tx => tx.ref_id).filter(Boolean) as string[]);
}

// 完成任务（添加交易记录并更新统计）
export async function completeTask(childId: string, taskId: string, points: number, title: string): Promise<Transaction> {
  const tx: Transaction = {
    id: crypto.randomUUID(),
    child_id: childId,
    type: 'task_complete',
    points: Math.abs(points),
    ref_id: taskId,
    idempotency_key: `task-${taskId}-${Date.now()}`,
    created_at: new Date().toISOString(),
    created_by: 'child',
    notes: `完成 ${title}`,
    sync_status: 'pending',
    reversed: false
  };
  
  await db.transactions.add(tx);
  await updateChildStats(childId, Math.abs(points), 0, 0);
  
  return tx;
}

// 执行扣分（添加交易记录并更新统计）
export async function applyPenalty(childId: string, penaltyId: string, points: number, title: string): Promise<Transaction> {
  const tx: Transaction = {
    id: crypto.randomUUID(),
    child_id: childId,
    type: 'penalty',
    points: -Math.abs(points),
    ref_id: penaltyId,
    idempotency_key: `penalty-${penaltyId}-${Date.now()}`,
    created_at: new Date().toISOString(),
    created_by: 'child',
    notes: title,
    sync_status: 'pending',
    reversed: false
  };
  
  await db.transactions.add(tx);
  // 扣分记入 penaltyDelta
  await updateChildStats(childId, 0, 0, Math.abs(points));
  
  return tx;
}

// 兑换奖励（添加交易记录并更新统计）
export async function redeemReward(childId: string, rewardId: string, cost: number, title: string): Promise<Transaction> {
  const tx: Transaction = {
    id: crypto.randomUUID(),
    child_id: childId,
    type: 'spend',
    points: -Math.abs(cost),
    ref_id: rewardId,
    idempotency_key: `reward-${rewardId}-${Date.now()}`,
    created_at: new Date().toISOString(),
    created_by: 'child',
    notes: `兑换 ${title}`,
    sync_status: 'pending',
    reversed: false
  };
  
  await db.transactions.add(tx);
  // 兑换消耗记入 spentDelta
  await updateChildStats(childId, 0, Math.abs(cost), 0);
  
  return tx;
}

// 获取交易列表（按时间倒序）
export async function listTransactions(childId: string): Promise<Transaction[]> {
  return db.transactions
    .where('child_id')
    .equals(childId)
    .reverse()
    .sortBy('created_at');
}

// 撤销交易
export async function reverseTransaction(childId: string, originalTx: Transaction): Promise<Transaction> {
  if (originalTx.reversed) {
    throw new Error('该交易已被撤销');
  }
  
  if (originalTx.type === 'reverse') {
    throw new Error('撤销记录不能再次撤销');
  }
  
  // 创建撤销交易
  const reverseTx: Transaction = {
    id: crypto.randomUUID(),
    child_id: childId,
    type: 'reverse',
    points: -originalTx.points, // 取反
    ref_id: originalTx.id, // 引用原交易
    idempotency_key: `reverse-${originalTx.id}`,
    created_at: new Date().toISOString(),
    created_by: 'child',
    notes: `撤销 ${originalTx.notes || ''}`,
    sync_status: 'pending',
    reversed: false
  };
  
  await db.transactions.add(reverseTx);
  
  // 标记原交易为已撤销
  await db.transactions.update(originalTx.id, {
    reversed: true,
    reversed_by: reverseTx.id
  });
  
  // 更新统计：根据原交易类型撤销相应的统计
  if (originalTx.type === 'task_complete') {
    // 撤销任务完成：减少 total_earned
    await updateChildStats(childId, -Math.abs(originalTx.points), 0, 0);
  } else if (originalTx.type === 'spend') {
    // 撤销兑换：减少 total_spent
    await updateChildStats(childId, 0, -Math.abs(originalTx.points), 0);
  } else if (originalTx.type === 'penalty') {
    // 撤销扣分：减少 total_penalty
    await updateChildStats(childId, 0, 0, -Math.abs(originalTx.points));
  }
  
  return reverseTx;
}
