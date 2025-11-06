import { db, ensureDefaultChild } from './db/dexie';

/**
 * 同步状态事件
 */
function emit(status: 'idle'|'syncing'|'error'|'offline', detail?: any) {
  try { 
    window.dispatchEvent(
      new CustomEvent('sync:status', { detail: { status, ...detail } })
    ); 
  } catch {}
}
// --- P2: Push 批量变更上行（首版保守：全量上行，由服务端 LWW 合并） ---

let retryDelay = 1000;
const maxDelay = 15000;

function getAccessKey(): string | null {
  try { return localStorage.getItem('ACCESS_KEY'); } catch { return null; }
}

type TxPostResponse = { ok: boolean; duplicate?: boolean; server_version?: number };
type SyncGetResponse = { ok: true; data: { child: any|null; tasks: any[]; rewards: any[]; penalties: any[]; transactions: any[] } } | { ok: false; error: string };
type SyncPostResponse = { ok: boolean; synced?: boolean; timestamp?: number; error?: string };

// --- P1: Pull/Bootstrap 增量同步辅助 ---
type PullResponse = {
  ok: true;
  cursor: number;
  changes: {
    child: any[];
    task_template: any[];
    reward_item: any[];
    penalty_rule: any[];
    transactions: any[];
  }
} | { ok: false; error: string };

type BootstrapResponse = {
  ok: true;
  cursor: number;
  data: {
    child: any|null;
    task_template: any[];
    reward_item: any[];
    penalty_rule: any[];
    transactions: any[];
  }
} | { ok: false; error: string };

const CURSOR_KEY = 'SYNC_CURSOR';
function getCursor(): number { try { return Number(localStorage.getItem(CURSOR_KEY) || '0'); } catch { return 0; } }
function setCursor(v: number) { try { localStorage.setItem(CURSOR_KEY, String(v)); } catch {} }
const DEVICE_ID_KEY = 'DEVICE_ID';
function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_ID_KEY, id); }
    return id;
  } catch { return 'unknown-device'; }
}

function newerThan(a?: string, b?: string) {
  if (!a && !b) return false;
  if (a && !b) return true;
  if (!a && b) return false;
  return new Date(a!).getTime() > new Date(b!).getTime();
}

async function mergeRow(table: 'child'|'task_template'|'reward_item'|'penalty_rule'|'transactions', row: any) {
  // P3：保留墓碑（deleted_at），查询时过滤；这里按 LWW 覆盖本地
  if (table === 'child') {
    const local = await db.children.get(row.id);
    if (!local || newerThan(row.updated_at, (local as any).updated_at)) {
      await db.children.put(row);
    }
  } else if (table === 'task_template') {
    const local = await db.tasks.get(row.id);
    if (!local || newerThan(row.updated_at, (local as any).updated_at)) {
      await db.tasks.put(row);
    }
  } else if (table === 'reward_item') {
    const local = await db.rewards.get(row.id);
    if (!local || newerThan(row.updated_at, (local as any).updated_at)) {
      await db.rewards.put(row);
    }
  } else if ((db as any).penalties && table === 'penalty_rule') {
    const local = await (db as any).penalties.get(row.id);
    if (!local || newerThan(row.updated_at, (local as any).updated_at)) {
      await (db as any).penalties.put(row);
    }
  } else if (table === 'transactions') {
    const local = await db.transactions.get(row.id);
    if (!local || newerThan(row.updated_at, (local as any).updated_at)) {
      await db.transactions.put({ ...row, sync_status: 'synced' });
    }
  }
}

export async function bootstrapIfNeeded() {
  const key = getAccessKey();
  if (!key) return false;
  if (getCursor() > 0) return true;
  try {
    const res = await fetch('/api/bootstrap', { headers: { 'x-access-key': key } });
    if (!res.ok) return false;
    const data = await res.json() as BootstrapResponse;
    if (!('ok' in data) || !data.ok) return false;
    await db.transaction('rw', db.children, db.tasks, db.rewards, db.transactions, async () => {
      await db.children.clear();
      await db.tasks.clear();
      await db.rewards.clear();
      if ((db as any).penalties) await (db as any).penalties.clear();
      await db.transactions.clear();
      if (data.data.child) await db.children.put(data.data.child as any);
      if (data.data.task_template?.length) await db.tasks.bulkPut(data.data.task_template as any);
      if (data.data.reward_item?.length) await db.rewards.bulkPut(data.data.reward_item as any);
      if (data.data.penalty_rule?.length && (db as any).penalties) await (db as any).penalties.bulkPut(data.data.penalty_rule as any);
      if (data.data.transactions?.length) await db.transactions.bulkPut(
        (data.data.transactions as any[]).map(x => ({ ...x, sync_status: 'synced' }))
      );
    });
    setCursor((data as any).cursor || 0);
    return true;
  } catch {
    return false;
  }
}

export async function pullOnce() {
  const key = getAccessKey();
  if (!key) return false;
  const cursor = getCursor();
  try {
    const res = await fetch(`/api/sync/pull?cursor=${cursor}&limit=500`, { headers: { 'x-access-key': key } });
    if (!res.ok) return false;
    const data = await res.json() as PullResponse;
    if (!('ok' in data) || !data.ok) return false;
    const changes = (data as any).changes || {};
    await db.transaction('rw', db.children, db.tasks, db.rewards, db.transactions, async () => {
      for (const row of (changes.child || [])) await mergeRow('child', row);
      for (const row of (changes.task_template || [])) await mergeRow('task_template', row);
      for (const row of (changes.reward_item || [])) await mergeRow('reward_item', row);
      for (const row of (changes.penalty_rule || [])) await mergeRow('penalty_rule', row);
      for (const row of (changes.transactions || [])) await mergeRow('transactions', row);
    });
    setCursor((data as any).cursor || cursor);
    return true;
  } catch {
    return false;
  }
}

// --- P2: Push 批量变更上行（首版保守：全量上行，由服务端 LWW 合并） ---
const LAST_PUSHED_KEY = 'LAST_PUSHED_AT';
function getLastPushed(): string { try { return localStorage.getItem(LAST_PUSHED_KEY) || '1970-01-01T00:00:00.000Z'; } catch { return '1970-01-01T00:00:00.000Z'; } }
function setLastPushed(iso: string) { try { localStorage.setItem(LAST_PUSHED_KEY, iso); } catch {} }

export async function pushOnce() {
  const key = getAccessKey();
  if (!key) return false;
  const device_id = getDeviceId();
  try {
    // 仅推“变更集”：updated_at > last_pushed 或者存在墓碑
    const last = getLastPushed();
    const after = (arr: any[]) => arr.filter(r => (r.updated_at && new Date(r.updated_at).getTime() > new Date(last).getTime()) || r.deleted_at);
    const child = after(await db.children.toArray().catch(() => []));
    const task_template = after(await db.tasks.toArray().catch(() => []));
    const reward_item = after(await db.rewards.toArray().catch(() => []));
    const penaltiesTbl = after((db as any).penalties ? await (db as any).penalties.toArray() : []);
    const transactions = after(await db.transactions.toArray());

    const changes = { child, task_template, reward_item, penalty_rule: penaltiesTbl, transactions };

    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-access-key': key },
      body: JSON.stringify({ device_id, changes })
    });
    if (!res.ok) return false;
    const data = await res.json() as any;
    if (data && data.ok) { setLastPushed(new Date().toISOString()); return true; }
    return false;
  } catch {
    return false;
  }
}

export async function ensureAccessAndChild() {
  let key = getAccessKey();
  if (!key) {
    try {
      const input = window.prompt('请输入访问密码');
      if (!input) throw new Error('no key');
      localStorage.setItem('ACCESS_KEY', input);
      key = input;
    } catch {
      emit('error', { auth: true });
      return false;
    }
  }
  try {
    const res = await fetch('/api/sync', { headers: { 'x-access-key': key! } });
    if (!res.ok) return false;
    const data = await res.json() as SyncGetResponse;
    if ('ok' in data && data.ok && !data.data.child) {
      const name = window.prompt('请设置孩子名字');
      if (!name) return true; // 用户取消
      const post = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-access-key': key! },
        body: JSON.stringify({ child: { name, created_at: new Date().toISOString() } })
      });
      return post.ok;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 同步待处理的交易记录
 */
export async function syncPending() {
  if (!navigator.onLine) { 
    emit('offline'); 
    return; 
  }
  const key = getAccessKey();
  if (!key) { emit('error', { auth: true }); return; }
  
  const pending = await db.transactions
    .where('sync_status')
    .equals('pending')
    .toArray();
    
  if (!pending.length) { 
    emit('idle'); 
    return; 
  }
  
  emit('syncing', { count: pending.length });
  let allOk = true;
  
  for (const tx of pending) {
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-access-key': key },
        body: JSON.stringify(tx)
      });
      
      if (!res.ok) throw new Error('bad status');
      
      const data = await res.json() as TxPostResponse;
      if (data && (data as TxPostResponse).ok) {
        await db.transactions.update(tx.id, { 
          sync_status: 'synced', 
          server_version: data.server_version 
        });
      } else {
        allOk = false;
      }
    } catch {
      allOk = false;
    }
  }
  
  if (allOk) { 
    emit('idle'); 
    retryDelay = 1000; 
  } else {
    emit('error');
    setTimeout(syncPending, retryDelay);
    retryDelay = Math.min(maxDelay, Math.floor(retryDelay * 1.8));
  }
}

/**
 * 全量同步：上传所有本地数据到服务器
 */
export async function syncAll() {
  if (!navigator.onLine) {
    emit('offline');
    return { ok: false, error: 'offline' };
  }
  const key = getAccessKey();
  if (!key) return { ok: false, error: 'unauthorized' };

  try {
    emit('syncing', { type: 'full' });

    // 获取所有本地数据
    const child = await ensureDefaultChild();
    const tasks = await db.tasks.toArray();
    const rewards = await db.rewards.toArray();
    const penalties = (db as any).penalties 
      ? await (db as any).penalties.toArray() 
      : [];
    const transactions = await db.transactions.toArray();

    // 上传到服务器
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-access-key': key },
      body: JSON.stringify({
        child,
        tasks,
        rewards,
        penalties,
        transactions
      })
    });

    if (!res.ok) throw new Error('sync failed');

    const data = await res.json() as SyncPostResponse;
    
    if ((data as SyncPostResponse).ok) {
      // 标记所有交易为已同步
      const allTxIds = transactions.map(tx => tx.id);
      for (const id of allTxIds) {
        await db.transactions.update(id, { sync_status: 'synced' });
      }
      
      emit('idle');
      return { ok: true };
    } else {
      throw new Error(data.error || 'unknown error');
    }
  } catch (e: any) {
    emit('error', { message: e.message });
    return { ok: false, error: e.message };
  }
}

/**
 * 下载服务器数据到本地（开发阶段使用）
 */
export async function downloadFromServer(childId?: string) {
  if (!navigator.onLine) {
    return { ok: false, error: 'offline' };
  }
  const key = getAccessKey();
  if (!key) return { ok: false, error: 'unauthorized' };

  try {
    const url = childId ? `/api/sync?child_id=${childId}` : '/api/sync';
    const res = await fetch(url, { headers: { 'x-access-key': key } });
    
    if (!res.ok) throw new Error('download failed');
    
    const data = await res.json();
    
    if (data && data.ok && data.data) {
      // 清空本地数据库（开发阶段）
      await db.transactions.clear();
      await db.tasks.clear();
      await db.rewards.clear();
      if ((db as any).penalties) {
        await (db as any).penalties.clear();
      }
      await db.children.clear();

      // 导入服务器数据
      if (data.data.child) {
        await db.children.add(data.data.child);
      }
      
      if (data.data.tasks) {
        await db.tasks.bulkAdd(data.data.tasks);
      }
      
      if (data.data.rewards) {
        await db.rewards.bulkAdd(data.data.rewards);
      }
      
      if (data.data.penalties && (db as any).penalties) {
        await (db as any).penalties.bulkAdd(data.data.penalties);
      }
      
      if (data.data.transactions) {
        await db.transactions.bulkAdd(
          data.data.transactions.map((tx: any) => ({
            ...tx,
            sync_status: 'synced'
          }))
        );
      }

      return { ok: true };
    } else {
      throw new Error(data.error || 'unknown error');
    }
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/**
 * 设置自动同步
 */
export function setupAutoSync() {
  const doSync = async () => { 
    await bootstrapIfNeeded();
    // 先 push 再 pull，减少反复覆盖（服务端 LWW 兜底）
    await pushOnce();
    await pullOnce();
    // 兼容旧的交易逐条上送路径（保留直到 push 精细化）
    await syncPending();
  };
  const onWake = () => { void doSync(); };
  window.addEventListener('online', onWake);
  window.addEventListener('focus', onWake);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) onWake(); });
  // 周期性拉取，避免长时间不触发事件
  setInterval(() => { void pullOnce(); }, 20000);
  void doSync();
}
