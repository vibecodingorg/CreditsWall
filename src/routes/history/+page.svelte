<script lang="ts">
  import { t } from 'svelte-i18n';
  import { onMount } from 'svelte';
  import { exportElementAsImage } from '$lib/report';
  import { listTransactions, reverseTransaction, getBalance, type Transaction } from '$lib/db/ledger';
  import { TrendingUp, TrendingDown, RotateCcw, Share2, Sparkles, Gift } from 'lucide-svelte';
  
  let items: Transaction[] = [];
  let balance = 0;
  
  async function refresh() { 
    items = await listTransactions(); 
    balance = await getBalance();
  }
  
  onMount(refresh);
  
  async function onReverse(tx: Transaction) {
    if (!confirm('撤销这条记录吗？')) return;
    await reverseTransaction(tx);
    await refresh();
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
  
  function getTypeColor(points: number) {
    return points > 0 ? 'text-green-600' : 'text-rose-600';
  }
  
  function getTypeIcon(points: number) {
    return points > 0 ? TrendingUp : TrendingDown;
  }
  
  let reportEl: HTMLElement;
  async function onExport() { 
    if (reportEl) await exportElementAsImage(reportEl, 'kids-points-report.png'); 
  }
</script>

<section class="p-6 space-y-6">
  <!-- 余额卡片 -->
  <div class="bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-2xl p-6 shadow-lg">
    <div class="text-sm opacity-90 mb-1">{$t('home.balance')}</div>
    <div class="text-5xl font-bold">{balance}</div>
  </div>
  
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
          <li class="bg-white border-2 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-center gap-3 flex-1">
              <!-- 图标 -->
              <div class="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                {#if it.points > 0}
                  <Sparkles class="text-green-600" size={20} />
                {:else}
                  <Gift class="text-rose-600" size={20} />
                {/if}
              </div>
              
              <!-- 信息 -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-lg {getTypeColor(it.points)}">
                    {sign(it.points)}
                  </span>
                  <span class="text-gray-700 truncate">{it.reason_code || it.type}</span>
                </div>
                <div class="text-xs text-gray-500 mt-1">{when(it.created_at)}</div>
              </div>
            </div>
            
            <!-- 撤销按钮 -->
            <button 
              class="flex-shrink-0 p-2 text-gray-600 hover:bg-gray-100 rounded-lg touch-feedback transition-colors" 
              on:click={() => onReverse(it)}
              title="撤销"
            >
              <RotateCcw size={18} />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>
