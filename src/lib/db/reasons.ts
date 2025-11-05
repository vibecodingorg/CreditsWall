import { db, type ReasonCatalog } from './dexie';

export interface ReasonItem { id?: string; code: string; title: string; category?: string; is_preset?: number; active?: number }

export async function listLocalCustomReasons(): Promise<ReasonItem[]> {
  const items = await db.reasons.where('is_preset').equals(0 as any).toArray();
  return items.map(r => ({ id: r.id, code: r.code, title: r.title, category: r.category, is_preset: r.is_preset, active: r.active }));
}

export async function addLocalReason(input: { code: string; title: string; category?: string }): Promise<ReasonItem> {
  const it: ReasonCatalog = {
    id: crypto.randomUUID(),
    code: input.code,
    title: input.title,
    category: input.category || 'custom',
    is_preset: 0,
    active: 1,
    created_at: new Date().toISOString()
  };
  await db.reasons.add(it);
  return it;
}

export async function listReasonsMerged(): Promise<ReasonItem[]> {
  try {
    const res = await fetch('/api/reasons');
    const data = await res.json();
    const apiItems: ReasonItem[] = Array.isArray(data?.items) ? data.items : [];
    const local = await listLocalCustomReasons();
    return [...apiItems, ...local];
  } catch {
    const local = await listLocalCustomReasons();
    return local;
  }
}

export async function deleteLocalReason(id: string) {
  await db.reasons.delete(id);
}
