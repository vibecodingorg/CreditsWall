<script lang="ts">
  import { t } from 'svelte-i18n';
  import { onMount } from 'svelte';
  import { exportElementAsImage } from '$lib/report';
  import { listTransactions, reverseTransaction, ensureDefaultChild, getChildStats, type Transaction } from '$lib/db/dexie';
  import { TrendingUp, TrendingDown, RotateCcw, Share2, Sparkles, Gift, AlertCircle } from 'lucide-svelte';
  import PointsCard from '$lib/components/PointsCard.svelte';
  
  let items: Transaction[] = [];
  let balance = 0;
  let totalEarned = 0;
  let totalSpent = 0;
  let totalPenalty = 0;
  let childId = '';
  
  async function refresh() {
    const child = await ensureDefaultChild();
    childId = child.id;
    const stats = await getChildStats(childId);
    balance = stats.balance;
    totalEarned = stats.totalEarned;
    totalSpent = stats.totalSpent;
    totalPenalty = stats.totalPenalty;
    items = await listTransactions(childId);
  }
  
  onMount(refresh);
  
  async function onReverse(tx: Transaction) {
    if (tx.reversed) {
      alert('该记录已被撤销');
      return;
    }
    if (tx.type === 'reverse') {
      alert('撤销记录不能再次撤销');
      return;
    }
    if (!confirm(`确认撤销「${tx.notes}」吗？`)) return;
    try {
      await reverseTransaction(childId, tx);
      await refresh();
    } catch (e: any) {
      alert(e.message || '撤销失败');
    }
  }
  
  function sign(p: number) { return p > 0 ? `+${p}` : `${p}`; }
  function when(ts: string) { 
    try { 
      const d = new Date(ts); 
      return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); 
    } catch { 
      return ts; 
    } 
  }
  
  function getTypeColor(tx: Transaction) {
    if (tx.reversed) return 'text-gray-400';
    return tx.points > 0 ? 'text-green-600' : 'text-rose-600';
  }
  
  function getTypeIcon(tx: Transaction) {
    if (tx.type === 'reverse') return RotateCcw;
    if (tx.type === 'task_complete') return Sparkles;
    if (tx.type === 'spend') return Gift;
    if (tx.type === 'penalty') return AlertCircle;
    return tx.points > 0 ? TrendingUp : TrendingDown;
  }
  
  let reportEl: HTMLElement;
  async function onExport() { 
    if (reportEl) await exportElementAsImage(reportEl, 'kids-points-report.png'); 
  }
</script>

<section class="p-6 space-y-6">
  <!-- 积分卡片 -->
  <PointsCard 
    {balance} 
    {totalEarned} 
    {totalSpent} 
    {totalPenalty} 
    variant="default" 
  />
  
  <!-- 操作按钮 -->
  <div class="flex justify-between items-center">
    <h2 class="text-lg font-semibold">{$t('history.title')}</h2>
    <button 
      class="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors" 
      on:click={onExport}
    >
      <Share2 size={18} />
      <span>{$t('actions.generateReport')}</span>
    </button>
  </div>
  
  <!-- 交易列表 -->
  <div bind:this={reportEl} class="space-y-3">
    {#if items.length === 0}
      <div class="text-center py-12 text-gray-400">
        <div class="text-5xl mb-3">📝</div>
        <div>暂无记录</div>
      </div>
    {:else}
      <ul class="space-y-3">
        {#each items as it}
          <li class="bg-white border-2 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
              class:opacity-50={it.reversed}
          >
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <!-- 图标 -->
              <div class="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <svelte:component this={getTypeIcon(it)} class={getTypeColor(it)} size={20} />
              </div>
              
              <!-- 信息 -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-lg {getTypeColor(it)}">
                    {sign(it.points)}
                  </span>
                  <span class="text-gray-700 truncate">{it.notes || it.type}</span>
                  {#if it.reversed}
                    <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">已撤销</span>
                  {/if}
                </div>
                <div class="text-xs text-gray-500 mt-1">{when(it.created_at)}</div>
              </div>
            </div>
            
            <!-- 撤销按钮 -->
            {#if !it.reversed && it.type !== 'reverse'}
              <button 
                class="flex-shrink-0 p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" 
                on:click={() => onReverse(it)}
                title="撤销"
              >
                <RotateCcw size={18} />
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>
