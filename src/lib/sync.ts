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

let retryDelay = 1000;
const maxDelay = 15000;

/**
 * 同步待处理的交易记录
 */
export async function syncPending() {
  if (!navigator.onLine) { 
    emit('offline'); 
    return; 
  }
  
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
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(tx)
      });
      
      if (!res.ok) throw new Error('bad status');
      
      const data = await res.json();
      if (data && data.ok) {
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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        child,
        tasks,
        rewards,
        penalties,
        transactions
      })
    });

    if (!res.ok) throw new Error('sync failed');

    const data = await res.json();
    
    if (data.ok) {
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

  try {
    const url = childId ? `/api/sync?child_id=${childId}` : '/api/sync';
    const res = await fetch(url);
    
    if (!res.ok) throw new Error('download failed');
    
    const data = await res.json();
    
    if (data.ok && data.data) {
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
  const handler = () => { syncPending(); };
  window.addEventListener('online', handler);
  window.addEventListener('focus', handler);
  document.addEventListener('visibilitychange', () => { 
    if (!document.hidden) handler(); 
  });
  syncPending();
}
