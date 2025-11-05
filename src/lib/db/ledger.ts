import { db, type Transaction, type TxType, ensureDefaultChild } from './dexie';

export async function addTransaction(params: {
  child_id?: string;
  type: TxType;
  points: number;
  ref_id?: string;
  reason_id?: string;
  reason_code?: string;
  reason_category?: string;
  tags?: string[];
  notes?: string;
  created_by?: 'local_device' | 'parent' | 'child';
}): Promise<Transaction> {
  const child = params.child_id ? { id: params.child_id } : await ensureDefaultChild();
  const tx: Transaction = {
    id: crypto.randomUUID(),
    child_id: (child as any).id,
    type: params.type,
    points: params.points,
    ref_id: params.ref_id,
    idempotency_key: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    created_by: params.created_by || 'local_device',
    reason_id: params.reason_id,
    reason_code: params.reason_code,
    reason_category: params.reason_category,
    tags: params.tags,
    notes: params.notes,
    sync_status: 'pending'
  };
  await db.transactions.add(tx);
  try { window.dispatchEvent(new CustomEvent('ledger:changed', { detail: { id: tx.id } })); } catch {}
  return tx;
}

export async function getBalance(child_id?: string): Promise<number> {
  const child = child_id ? { id: child_id } : await ensureDefaultChild();
  const sum = await db.transactions.where('child_id').equals((child as any).id).toArray()
    .then(list => list.reduce((acc, t) => acc + (t.points || 0), 0));
  return sum;
}

export async function listTransactions(child_id?: string): Promise<Transaction[]> {
  const child = child_id ? { id: child_id } : await ensureDefaultChild();
  return db.transactions.where('child_id').equals((child as any).id).reverse().sortBy('created_at');
}

export async function reverseTransaction(original: Transaction): Promise<Transaction> {
  return addTransaction({
    child_id: original.child_id,
    type: 'reverse',
    points: -original.points,
    ref_id: original.id,
    reason_code: original.reason_code,
    reason_category: original.reason_category,
    notes: original.notes,
    created_by: 'parent'
  });
}
