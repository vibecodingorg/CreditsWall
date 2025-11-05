<script lang="ts">
  import { t } from 'svelte-i18n';
  import { addTransaction, getBalance } from '$lib/db/ledger';
  import { listRewards } from '$lib/db/dexie';
  import { onMount } from 'svelte';
  import RewardCard from '$lib/components/RewardCard.svelte';
  import SuccessFeedback from '$lib/components/SuccessFeedback.svelte';
  
  let balance = 0;
  async function refresh() { balance = await getBalance(); }
  
  onMount(() => {
    refresh();
    const handler = () => { refresh(); };
    window.addEventListener('ledger:changed', handler);
    return () => window.removeEventListener('ledger:changed', handler);
  });
  
  let showConfirm = false;
  let current: { title: string; cost: number; icon?: string } | null = null;
  let selectedReason = 'reward';
  
  let reasons = [
    { code: 'reward', title: '奖励消费' },
    { code: 'family.activity', title: '家庭活动' },
    { code: 'snack', title: '零食' }
  ];
  
  onMount(async () => {
    try {
      const res = await fetch('/api/reasons');
      const data = await res.json();
      if (data && Array.isArray(data.items) && data.items.length) {
        reasons = data.items.map((r: any) => ({ code: r.code, title: r.title }));
        if (!reasons.find(r => r.code === selectedReason)) selectedReason = reasons[0].code;
      }
    } catch {}
  });
  
  type RewardItem = { title: string; cost: number; color: string; icon?: string };
  let items: RewardItem[] = [];
  
  async function loadRewards() {
    const rw = await listRewards();
    const actives = rw.filter(r => r.active === 1);
    if (actives.length) {
      items = actives.map((r, i) => ({ 
        title: r.title, 
        cost: r.cost_points, 
        color: i % 2 ? 'bg-yellow-500' : 'bg-rose-500',
        icon: r.icon || null
      }));
    } else {
      // 默认奖励带图标
      items = [
        { title: '棒棒糖', cost: 5, color: 'bg-rose-500', icon: 'candy' },
        { title: '动画片30分钟', cost: 10, color: 'bg-yellow-500', icon: 'tv' },
        { title: '冰淇淋', cost: 8, color: 'bg-pink-500', icon: 'ice-cream' },
        { title: '游戏时间', cost: 15, color: 'bg-purple-500', icon: 'game' }
      ];
    }
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
    
    await addTransaction({ 
      type: 'spend', 
      points: -current.cost, 
      reason_code: selectedReason, 
      reason_category: 'reward', 
      created_by: 'child' 
    });
    
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
  <!-- 余额卡片 -->
  <div class="bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-2xl p-6 shadow-lg">
    <div class="text-sm opacity-90 mb-1">{$t('home.balance')}</div>
    <div class="text-5xl font-bold">{balance}</div>
  </div>
  
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
{#if showConfirm}
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-40 animate-fade-in">
    <div class="bg-white rounded-2xl p-6 w-80 max-w-[90%] space-y-4 animate-slide-up">
      <div class="font-semibold text-xl">确认兑换</div>
      <div class="text-gray-700">{current?.title}</div>
      <div class="text-2xl font-bold text-rose-500">-{current?.cost}</div>
      
      <div class="space-y-2">
        <label for="reason-select" class="text-sm font-medium">选择理由</label>
        <select id="reason-select" class="w-full border-2 rounded-lg p-3 text-base" bind:value={selectedReason}>
          {#each reasons as r}
            <option value={r.code}>{r.title}</option>
          {/each}
        </select>
      </div>
      
      <div class="flex gap-3 pt-2">
        <button 
          class="flex-1 px-4 py-3 border-2 rounded-xl font-medium touch-feedback" 
          on:click={cancel}
        >
          取消
        </button>
        <button 
          class="flex-1 px-4 py-3 rounded-xl bg-rose-500 text-white font-medium touch-feedback" 
          on:click={confirmSpend}
        >
          确认
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
