<script lang="ts">
  import { onMount } from 'svelte';
  let accessKey = '';
  let confirmText = '';
  let busy = false;
  let msg: string | null = null;

  onMount(() => {
    try { accessKey = localStorage.getItem('ACCESS_KEY') || ''; } catch {}
  });

  async function clearLocalData() {
    try {
      const keys = ['SYNC_CURSOR', 'LAST_PUSHED_AT', 'DEVICE_ID', 'BOOTSTRAP_V2_DONE', 'PENALTY_FORCE_SYNC_V1'];
      for (const key of keys) {
        try { localStorage.removeItem(key); } catch {}
      }
    } catch {}

    try {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('kids-points');
        request.onsuccess = () => resolve();
        request.onblocked = () => resolve();
        request.onerror = () => reject(request.error ?? new Error('delete failed'));
      });
    } catch (e) {
      throw e;
    }
  }

  async function resetAll() {
    msg = null;
    if (confirmText !== 'RESET-ALL') {
      msg = '请输入确认文本：RESET-ALL';
      return;
    }
    busy = true;
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-access-key': accessKey },
        body: JSON.stringify({ confirm: 'RESET-ALL' })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        try {
          await clearLocalData();
          msg = '已清空远程数据并清理本地缓存，请刷新页面后重新配置。';
        } catch (e) {
          msg = `远程已清空，但本地清理失败：${(e as any)?.message || e}`;
        }
      } else {
        msg = `失败：${data?.error || 'unknown error'}`;
      }
    } catch (e) {
      msg = `异常：${(e as any)?.message || e}`;
    } finally {
      busy = false;
    }
  }
</script>

<section class="p-6 max-w-xl mx-auto space-y-4">
  <h1 class="text-2xl font-bold">Admin - 清空全部数据</h1>
  <p class="text-sm text-rose-600">危险操作：将删除 child / task_template / reward_item / penalty_rule / reason_catalog / transactions，并重置 server cursor。</p>

  <div class="space-y-2">
    <label class="block text-sm">访问密钥（从本地存储自动填充，可手动修改）</label>
    <input class="border rounded p-2 w-full" bind:value={accessKey} placeholder="X-Access-Key" />
  </div>

  <div class="space-y-2">
    <label class="block text-sm">确认文本</label>
    <input class="border rounded p-2 w-full" bind:value={confirmText} placeholder="输入 RESET-ALL 以继续" />
  </div>

  <button class="px-4 py-2 bg-rose-600 text-white rounded disabled:opacity-50" disabled={busy} on:click={resetAll}>立即清空</button>

  {#if msg}
    <div class="p-3 bg-gray-100 rounded">{msg}</div>
  {/if}
</section>
