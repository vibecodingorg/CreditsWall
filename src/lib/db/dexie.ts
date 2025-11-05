import Dexie, { type Table } from 'dexie';

export interface Child { id: string; name: string; avatar?: string; color?: string; created_at: string }

export async function listTasks(): Promise<TaskTemplate[]> {
  return db.tasks.orderBy('created_at').toArray();
}

export async function addTask(input: { title: string; points: number; icon?: string }): Promise<TaskTemplate> {
  const t: TaskTemplate = { id: crypto.randomUUID(), title: input.title, points: input.points, icon: input.icon, active: 1, created_at: new Date().toISOString() };
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

export async function addPenaltyRule(input: { title: string; mode: 'fixed'|'percent'; value: number; basis?: 'current_balance'|'today_earned'|'task_points'; rounding?: 'down'|'nearest'|'up' }): Promise<PenaltyRule> {
  const p: PenaltyRule = { id: crypto.randomUUID(), title: input.title, mode: input.mode, value: input.value, basis: input.basis, rounding: input.rounding, active: 1, created_at: new Date().toISOString() };
  // @ts-ignore
  await (db as any).penalties.add(p);
  return p;
}

export async function togglePenaltyRuleActive(id: string, active: boolean): Promise<void> {
  // @ts-ignore
  await (db as any).penalties.update(id, { active: active ? 1 : 0 });
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
export interface TaskTemplate { id: string; title: string; points: number; icon?: string; active: number; created_at: string }
export interface RewardItem { id: string; title: string; cost_points: number; icon?: string; active: number; created_at: string }
export interface PenaltyRule { id: string; title: string; mode: 'fixed'|'percent'; value: number; basis?: 'current_balance'|'today_earned'|'task_points'; rounding?: 'down'|'nearest'|'up'; active: number; created_at: string }
export type TxType = 'issue' | 'spend' | 'reverse' | 'adjust';
export interface Transaction {
  id: string; child_id: string; type: TxType; points: number; ref_id?: string;
  idempotency_key: string; created_at: string; created_by: 'local_device'|'parent'|'child';
  rule_id?: string; calc_basis?: 'current_balance'|'today_earned'|'task_points'; calc_snapshot?: any;
  reason_id?: string; reason_code?: string; reason_category?: string; tags?: string[]; notes?: string
  sync_status?: 'pending'|'synced'|'error'; server_version?: number;
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
    created_at: new Date().toISOString()
  };
  await db.children.add(child);
  return child;
}
