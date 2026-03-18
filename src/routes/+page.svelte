<script lang="ts">
  import { t } from 'svelte-i18n';
  import { onMount, onDestroy } from 'svelte';
  import { listTasks, listPenaltyRules, ensureDefaultChild, getChildStats, getTodayCompletedTasks, completeTask, applyPenalty, type TaskTemplate, type PenaltyRule } from '$lib/db/dexie';
  import TaskCard from '$lib/components/TaskCard.svelte';
  import SuccessFeedback from '$lib/components/SuccessFeedback.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import PointsCard from '$lib/components/PointsCard.svelte';
  
  // 统计信息
  let balance = 0;
  let totalEarned = 0;
  let totalSpent = 0;
  let totalPenalty = 0;
  let childId = '';
  
  // Tab 状态 (移动端)
  let activeTab: 'tasks' | 'penalties' = 'tasks';
  
  // 任务和扣分项
  let tasks: (TaskTemplate & { completed?: boolean })[] = [];
  let penalties: PenaltyRule[] = [];
  let completedTaskIds: Set<string> = new Set();
  
  // 确认对话框状态
  let showConfirm = false;
  let confirmTitle = '';
  let confirmMessage = '';
  let confirmAction: (() => void) | null = null;
  
  // 成功反馈状态
  let showSuccess = false;
  let lastPoints = 0;
  let successType: 'earn' | 'spend' | 'success' = 'earn';
  
  async function refresh() {
    const child = await ensureDefaultChild();
    childId = child.id;
    
    const stats = await getChildStats(childId);
    balance = stats.balance;
    totalEarned = stats.totalEarned;
    totalSpent = stats.totalSpent;
    totalPenalty = stats.totalPenalty;
    
    // 加载今日完成状态
    completedTaskIds = await getTodayCompletedTasks(childId);
    
    // 加载任务
    const taskList = await listTasks();
    tasks = taskList
      .filter(t => t.active === 1)
      .map(t => ({
        ...t,
        completed: completedTaskIds.has(t.id) && t.type === 'daily'
      }))
      // 此时一次性任务如果完成了，会被自动软删除 (active=0)，所以 listTasks 不会返回它
      // 我们只需要过滤掉那些虽然 active=1 但莫名其妙被标记完成的一次性任务（理论上不应该存在，但为了保险）
      .filter(t => !(t.type === 'single' && completedTaskIds.has(t.id))) 
      .sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0)); // 已完成排后
    
    // 加载扣分项
    const penaltyList = await listPenaltyRules();
    penalties = penaltyList.filter(p => p.active === 1);
  }
  
  onMount(() => {
    refresh();
    const onLedger = () => { refresh(); };
    window.addEventListener('ledger:changed', onLedger);
    return () => { window.removeEventListener('ledger:changed', onLedger); };
  });
  
  // 长按完成任务
  function handleTaskLongPress(task: TaskTemplate) {
    if (task.completed) return; // 每日任务已完成
    
    confirmTitle = '确认完成任务';
    confirmMessage = `完成「${task.title}」可获得 +${task.points} 积分`;
    confirmAction = () => handleCompleteTask(task);
    showConfirm = true;
  }
  
  async function handleCompleteTask(task: TaskTemplate) {
    await completeTask(childId, task.id, task.points, task.title);
    
    lastPoints = task.points;
    successType = 'earn';
    showSuccess = true;
    
    await refresh();
  }
  
  // 长按扣分
  function handlePenaltyLongPress(penalty: PenaltyRule) {
    const points = penalty.mode === 'fixed' ? penalty.value : Math.floor(balance * penalty.value / 100);
    
    confirmTitle = '确认扣分';
    confirmMessage = `「${penalty.title}」将扣除 ${points} 积分`;
    confirmAction = () => handleApplyPenalty(penalty, points);
    showConfirm = true;
  }
  
  async function handleApplyPenalty(penalty: PenaltyRule, points: number) {
    await applyPenalty(childId, penalty.id, points, penalty.title);
    
    lastPoints = -Math.abs(points);
    successType = 'spend';
    showSuccess = true;
    
    await refresh();
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
  
  <!-- 移动端 Tab 切换 (小于 768px) -->
  <div class="md:hidden flex gap-2 mb-4">
    <button
      class="flex-1 py-3 px-4 rounded-xl font-semibold transition-all"
      class:bg-green-500={activeTab === 'tasks'}
      class:text-white={activeTab === 'tasks'}
      class:bg-gray-100={activeTab !== 'tasks'}
      class:text-gray-600={activeTab !== 'tasks'}
      on:click={() => activeTab = 'tasks'}
    >
      ✅ 任务打卡 ({tasks.length})
    </button>
    <button
      class="flex-1 py-3 px-4 rounded-xl font-semibold transition-all"
      class:bg-rose-500={activeTab === 'penalties'}
      class:text-white={activeTab === 'penalties'}
      class:bg-gray-100={activeTab !== 'penalties'}
      class:text-gray-600={activeTab !== 'penalties'}
      on:click={() => activeTab = 'penalties'}
    >
      ⚠️ 扣分项 ({penalties.length})
    </button>
  </div>
  
  <!-- 响应式布局：iPad 两栏 / iPhone 单栏 -->
  <div class="grid md:grid-cols-2 gap-6">
    <!-- 任务栏 -->
    <div class:hidden={activeTab !== 'tasks'} class:block={activeTab === 'tasks'} class="md:block h-full">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold flex items-center gap-2">
          <span class="text-2xl">📝</span>
          <span>今日任务</span>
        </h2>
        <span class="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">{tasks.length}</span>
      </div>
      <div class="space-y-3 h-full">
        {#if tasks.length === 0}
          <div class="text-center py-12 text-gray-400">
            <div class="text-5xl mb-3">📋</div>
            <div>暂无任务</div>
          </div>
        {:else}
          {#each tasks as task}
            <TaskCard
              title={task.title}
              points={task.points}
              icon={task.icon || 'star'}
              color="bg-green-500"
              completed={task.completed}
              completedText="已完成"
              onClick={() => handleTaskLongPress(task)}
            />
          {/each}
        {/if}
      </div>
    </div>
    
    <!-- 扣分栏 -->
    <div class:hidden={activeTab !== 'penalties'} class:block={activeTab === 'penalties'} class="md:block h-full">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold flex items-center gap-2">
          <span class="text-2xl">⚠️</span>
          <span>扣分项</span>
        </h2>
        <span class="px-3 py-1 bg-rose-100 text-rose-700 text-sm font-semibold rounded-full">{penalties.length}</span>
      </div>
      <div class="space-y-3 h-full">
        {#if penalties.length === 0}
          <div class="text-center py-12 text-gray-400">
            <div class="text-5xl mb-3">🚫</div>
            <div>暂无扣分项</div>
          </div>
        {:else}
          {#each penalties as penalty}
            <TaskCard
              title={penalty.title}
              points={penalty.mode === 'fixed' ? -penalty.value : -penalty.value}
              pointsText={penalty.mode === 'percent' ? `-${penalty.value}%` : null}
              icon={penalty.icon || 'alert'}
              color="bg-rose-500"
              onClick={() => handlePenaltyLongPress(penalty)}
            />
          {/each}
        {/if}
      </div>
    </div>
  </div>
</section>

<!-- 确认对话框 -->
<ConfirmDialog
  bind:show={showConfirm}
  title={confirmTitle}
  message={confirmMessage}
  onConfirm={() => confirmAction && confirmAction()}
/>

<!-- 成功反馈动画 -->
<SuccessFeedback
  bind:show={showSuccess}
  type={successType}
  message={successType === 'earn' ? '太棒了！' : '已扣分'}
  points={lastPoints}
  onClose={() => { showSuccess = false; }}
/>
