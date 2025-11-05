<script lang="ts">
  import { t } from 'svelte-i18n';
  import { onMount } from 'svelte';
  import { addTransaction, getBalance } from '$lib/db/ledger';
  import { listTasks } from '$lib/db/dexie';
  import TaskCard from '$lib/components/TaskCard.svelte';
  import SuccessFeedback from '$lib/components/SuccessFeedback.svelte';
  
  let balance = 0;
  async function refresh() { balance = await getBalance(); }
  
  onMount(() => {
    refresh();
    const handler = () => { refresh(); };
    window.addEventListener('ledger:changed', handler);
    return () => window.removeEventListener('ledger:changed', handler);
  });
  
  // 成功反馈状态
  let showSuccess = false;
  let lastPoints = 0;
  
  async function add(points: number, reason_code: string) {
    await addTransaction({ type: 'issue', points, reason_code, reason_category: 'study', created_by: 'child' });
    
    // 显示成功动画
    lastPoints = points;
    showSuccess = true;
    
    await refresh();
  }
  
  type Task = { title: string; points: number; code: string; color: string; icon?: string };
  let tasks: Task[] = [];
  
  async function loadTasks() {
    const list = await listTasks();
    const actives = list.filter(t => t.active === 1);
    if (actives.length) {
      tasks = actives.map(t => ({ 
        title: t.title, 
        points: t.points, 
        code: t.title, 
        color: 'bg-green-500',
        icon: t.icon || null
      }));
    } else {
      // 默认任务带图标
      tasks = [
        { title: '刷牙', points: 5, color: 'bg-green-500', code: 'health.brushing', icon: 'sparkles' },
        { title: '作业', points: 5, color: 'bg-blue-500', code: 'study.homework', icon: 'book' },
        { title: '收纳', points: 3, color: 'bg-purple-500', code: 'chores.cleanroom', icon: 'clean' },
        { title: '运动', points: 3, color: 'bg-orange-500', code: 'health.exercise', icon: 'bike' }
      ];
    }
  }
  
  onMount(loadTasks);
</script>

<section class="p-6 space-y-6">
  <!-- 余额卡片 -->
  <div class="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-2xl p-6 shadow-lg">
    <div class="text-sm opacity-90 mb-1">{$t('home.balance')}</div>
    <div class="text-5xl font-bold">{balance}</div>
  </div>
  
  <!-- 任务网格 -->
  <div>
    <h2 class="text-lg font-semibold mb-3">{$t('home.todayTasks')}</h2>
    <div class="grid grid-cols-2 gap-4">
      {#each tasks as tsk}
        <TaskCard
          title={tsk.title}
          points={tsk.points}
          icon={tsk.icon}
          color={tsk.color}
          onClick={() => add(tsk.points, tsk.code)}
        />
      {/each}
    </div>
  </div>
</section>

<!-- 成功反馈动画 -->
<SuccessFeedback
  bind:show={showSuccess}
  type="earn"
  message="太棒了！"
  points={lastPoints}
  onClose={() => { showSuccess = false; }}
/>
