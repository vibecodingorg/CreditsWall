import { db } from './db/dexie';

function emit(status: 'idle'|'syncing'|'error'|'offline', detail?: any) {
  try { window.dispatchEvent(new CustomEvent('sync:status', { detail: { status, ...detail } })); } catch {}
}

let retryDelay = 1000;
const maxDelay = 15000;

export async function syncPending() {
  if (!navigator.onLine) { emit('offline'); return; }
  const pending = await db.transactions.where('sync_status').equals('pending').toArray();
  if (!pending.length) { emit('idle'); return; }
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
        await db.transactions.update(tx.id, { sync_status: 'synced', server_version: data.server_version });
      } else {
        allOk = false;
      }
    } catch {
      allOk = false;
    }
  }
  if (allOk) { emit('idle'); retryDelay = 1000; }
  else {
    emit('error');
    setTimeout(syncPending, retryDelay);
    retryDelay = Math.min(maxDelay, Math.floor(retryDelay * 1.8));
  }
}

export function setupAutoSync() {
  const handler = () => { syncPending(); };
  window.addEventListener('online', handler);
  window.addEventListener('focus', handler);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) handler(); });
  syncPending();
}
