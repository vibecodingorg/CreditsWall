<script lang="ts">
  import { t } from 'svelte-i18n';
  import { listRewards, ensureDefaultChild, getChildStats, redeemReward } from '$lib/db/dexie';
  import { onMount } from 'svelte';
  import RewardCard from '$lib/components/RewardCard.svelte';
  import SuccessFeedback from '$lib/components/SuccessFeedback.svelte';
  import PointsCard from '$lib/components/PointsCard.svelte';
  
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
  }
  
  onMount(() => {
    refresh();
    loadRewards();
  });
  
  let showConfirm = false;
  let current: { title: string; cost: number; icon?: string } | null = null;
  
  type RewardItem = { title: string; cost: number; color: string; icon?: string };
  let items: RewardItem[] = [];
  
  async function loadRewards() {
    const rw = await listRewards();
    const actives = rw.filter(r => r.active === 1);
    items = actives.map((r, i) => ({ 
      title: r.title, 
      cost: r.cost_points, 
      color: i % 2 ? 'bg-yellow-500' : 'bg-rose-500',
      icon: r.icon || null
    }));
  }
  
  onMount(loadRewards);
  
  function onLongPress(it: RewardItem) {
    current = it;
    showConfirm = true;
  }
  
  // 成功反馈
  let showSuccess = false;
  let lastCost = 0;
  
  async function confirmSpend() {
    if (!current) return;
    
    // 使用新的兑换函数
    await redeemReward(childId, current.icon || 'gift', current.cost, current.title);
    
    // 显示成功动画
    lastCost = current.cost;
    showSuccess = true;
    
    showConfirm = false;
    current = null;
    
    await refresh();
  }
  
  function cancel() { 
    showConfirm = false; 
    current = null; 
  }
</script>

<section class="p-6 space-y-6">
  <!-- 积分卡片 -->
  <PointsCard 
    {balance} 
    {totalEarned} 
    {totalSpent} 
    {totalPenalty} 
    variant="store" 
  />
  
  <!-- 奖励网格 -->
  <div>
    <h2 class="text-lg font-semibold mb-3">{$t('store.title')}</h2>
    <div class="text-sm text-gray-500 mb-3">{$t('store.longpress')}</div>
    <div class="grid grid-cols-2 gap-4">
      {#each items as it}
        <RewardCard
          title={it.title}
          cost={it.cost}
          icon={it.icon}
          color={it.color}
          disabled={balance < it.cost}
          onLongPress={() => onLongPress(it)}
        />
      {/each}
    </div>
  </div>
</section>

<!-- 确认弹窗 -->
{#if showConfirm && current}
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-40 animate-fade-in" on:click={cancel}>
    <div class="bg-white rounded-2xl p-6 w-80 max-w-[90%] space-y-4 animate-slide-up" on:click|stopPropagation>
      <div class="font-semibold text-xl">确认兑换</div>
      <div class="text-gray-700 text-lg">{current.title}</div>
      <div class="text-3xl font-bold text-rose-500">-{current.cost} 积分</div>
      
      <div class="flex gap-3 pt-2">
        <button 
          class="flex-1 px-4 py-3 border-2 rounded-xl font-medium hover:bg-gray-50 transition-colors" 
          on:click={cancel}
        >
          取消
        </button>
        <button 
          class="flex-1 px-4 py-3 rounded-xl bg-rose-500 text-white font-medium hover:bg-rose-600 transition-colors" 
          on:click={confirmSpend}
        >
          确认兑换
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 成功反馈动画 -->
<SuccessFeedback
  bind:show={showSuccess}
  type="spend"
  message="兑换成功！"
  points={-lastCost}
  onClose={() => { showSuccess = false; }}
/>
