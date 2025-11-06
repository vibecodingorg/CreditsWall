<script lang="ts">
  import { t } from 'svelte-i18n';
  import { onMount } from 'svelte';
  import { listTasks, addTask, toggleTaskActive, listRewards, addReward, toggleRewardActive, listPenaltyRules, addPenaltyRule, togglePenaltyRuleActive, deleteTask, deleteReward, deletePenaltyRule } from '$lib/db/dexie';
  import { Users, Sparkles, Gift, AlertCircle, Plus, Trash2, Settings2 as Settings } from 'lucide-svelte';
  import IconPicker from '$lib/components/IconPicker.svelte';
  import { getIcon } from '$lib/icons';
  
  let childName: string = '';
  let tasks: { id: string; title: string; points: number; icon?: string; type?: 'single'|'daily'; active: number }[] = [];
  let newTask = { title: '', points: 5, icon: '', type: 'daily' as 'single'|'daily' };
  let showTaskIconPicker = false;
  let rewards: { id: string; title: string; cost_points: number; icon?: string; active: number }[] = [];
  let newReward = { title: '', cost_points: 5, icon: '' };
  let showRewardIconPicker = false;
  let penalties: { id: string; title: string; icon?: string; mode: 'fixed'|'percent'; value: number; basis?: string; rounding?: string; active: number }[] = [];
  let newPenalty = { title: '', icon: '', mode: 'fixed' as 'fixed'|'percent', value: 5, basis: 'current_balance', rounding: 'down' };
  let showPenaltyIconPicker = false;
  async function refreshTasks() { tasks = await listTasks(); }
  async function refreshRewards() { rewards = await listRewards(); }
  async function refreshPenalties() { penalties = await listPenaltyRules(); }
  onMount(async () => { await loadChildName(); await refreshTasks(); await refreshRewards(); await refreshPenalties(); });

  async function loadChildName() {
    try {
      const key = localStorage.getItem('ACCESS_KEY');
      const res = await fetch('/api/sync', { headers: { 'x-access-key': key || '' } });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.ok && data.data && data.data.child) {
        childName = data.data.child.name || '';
      }
    } catch {}
  }

  async function saveChildName() {
    if (!childName) return alert('请输入孩子名字');
    const key = localStorage.getItem('ACCESS_KEY') || '';
    const payload = { child: { name: childName, created_at: new Date().toISOString() } };
    const res = await fetch('/api/sync', { method: 'POST', headers: { 'content-type': 'application/json', 'x-access-key': key }, body: JSON.stringify(payload) });
    if (!res.ok) return alert('保存失败');
    alert('已保存');
  }
  async function addTaskAction() {
    if (!newTask.title || !newTask.points) return alert('请输入任务标题与积分');
    await addTask({ title: newTask.title, points: Number(newTask.points), icon: newTask.icon || undefined, type: newTask.type });
    newTask = { title: '', points: 5, icon: '', type: 'daily' };
    await refreshTasks();
  }
  async function toggleTask(id: string, active: boolean) {
    await toggleTaskActive(id, active);
    await refreshTasks();
  }
  async function removeTask(id: string) {
    if (!confirm('确定删除该任务吗？')) return;
    await deleteTask(id);
    await refreshTasks();
  }
  async function addRewardAction() {
    if (!newReward.title || !newReward.cost_points) return alert('请输入奖励标题与消耗积分');
    await addReward({ title: newReward.title, cost_points: Number(newReward.cost_points), icon: newReward.icon || undefined });
    newReward = { title: '', cost_points: 5, icon: '' };
    await refreshRewards();
  }
  async function toggleReward(id: string, active: boolean) {
    await toggleRewardActive(id, active);
    await refreshRewards();
  }
  async function removeReward(id: string) {
    if (!confirm('确定删除该奖励吗？')) return;
    await deleteReward(id);
    await refreshRewards();
  }
  async function addPenaltyAction() {
    if (!newPenalty.title || !newPenalty.value) return alert('请输入规则标题与数值');
    await addPenaltyRule({ title: newPenalty.title, icon: newPenalty.icon || undefined, mode: newPenalty.mode, value: Number(newPenalty.value), basis: newPenalty.basis as any, rounding: newPenalty.rounding as any });
    newPenalty = { title: '', icon: '', mode: 'fixed', value: 5, basis: 'current_balance', rounding: 'down' };
    await refreshPenalties();
  }
  async function togglePenalty(id: string, active: boolean) {
    await togglePenaltyRuleActive(id, active);
    await refreshPenalties();
  }
  async function removePenalty(id: string) {
    if (!confirm('确定删除该扣分规则吗？')) return;
    await deletePenaltyRule(id);
    await refreshPenalties();
  }
</script>

<section class="p-6 space-y-6">
  <h2 class="text-2xl font-bold flex items-center gap-2">
    <Settings size={28} class="text-gray-700" />
    {$t('settings.title')}
  </h2>
  
  <!-- 孩子设置（单 child） -->
  <div class="bg-white rounded-2xl shadow-sm border-2 p-5 space-y-4">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <Users class="text-blue-600" size={22} />
      </div>
      <h3 class="text-lg font-semibold">孩子设置</h3>
    </div>

    <div class="space-y-3">
      <div class="flex gap-2">
        <input class="border-2 rounded-lg p-3 flex-1" placeholder="孩子名字" bind:value={childName} />
        <button type="button" class="px-4 py-3 bg-blue-500 text-white rounded-lg font-medium touch-feedback flex items-center gap-2" on:click={saveChildName}>
          <Plus size={18} /> 保存
        </button>
      </div>
      <p class="text-xs text-gray-400">说明：系统采用单孩子模式，所有积分将归属该孩子</p>
    </div>
  </div>
  
  <!-- 任务管理 -->
  <div class="bg-white rounded-2xl shadow-sm border-2 p-5 space-y-4">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <Sparkles class="text-green-600" size={22} />
      </div>
      <h3 class="text-lg font-semibold">{$t('settings.tasks')}</h3>
    </div>
    
    <div class="space-y-3">
      <div class="grid grid-cols-1 gap-3">
        <input class="border-2 rounded-lg p-3" placeholder="任务标题" bind:value={newTask.title} />
        <div class="flex gap-2">
          <input class="border-2 rounded-lg p-3 w-20" type="number" min="1" bind:value={newTask.points} placeholder="积分" />
          <select class="border-2 rounded-lg p-3 flex-1" bind:value={newTask.type}>
            <option value="daily">每日循环</option>
            <option value="single">单次任务</option>
          </select>
          <button type="button" class="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium flex items-center gap-2" on:click={() => showTaskIconPicker = !showTaskIconPicker}>
            {#if newTask.icon && getIcon(newTask.icon)?.component}
              <svelte:component this={getIcon(newTask.icon).component} size={18} />
            {:else}
              ➕
            {/if}
            图标
          </button>
          <button type="button" class="px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 flex items-center gap-2" on:click={addTaskAction}>
            <Plus size={18} /> 添加
          </button>
        </div>
        {#if showTaskIconPicker}
          <div class="border-2 rounded-lg p-3">
            <IconPicker 
              selected={newTask.icon} 
              onSelect={(icon) => { 
                newTask = { ...newTask, icon }; 
                showTaskIconPicker = false; 
              }} 
            />
          </div>
        {/if}
      </div>
      
      <div class="space-y-2">
        {#each tasks as t}
          <div class="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
            <div class="flex items-center gap-3 flex-1">
              <!-- 图标 -->
              <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                {#if t.icon && getIcon(t.icon)?.component}
                  <svelte:component this={getIcon(t.icon).component} size={20} class="text-green-600" />
                {:else}
                  <Sparkles size={20} class="text-green-600" />
                {/if}
              </div>
              <!-- 信息 -->
              <div class="flex-1">
                <div class="font-medium">{t.title}</div>
                <div class="text-xs text-gray-500">
                  <span class="text-green-600">+{t.points}</span>
                  <span class="ml-2">{t.type === 'single' ? '🎯 单次' : '🔄 每日'}</span>
                </div>
              </div>
            </div>
            <!-- 操作 -->
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1 text-sm cursor-pointer">
                <input type="checkbox" checked={t.active===1} on:change={(e) => toggleTask(t.id, (e.target as HTMLInputElement).checked)} class="cursor-pointer" />
                <span>启用</span>
              </label>
              <button type="button" class="p-2 text-rose-600 hover:bg-rose-50 rounded-lg" on:click={() => removeTask(t.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
  
  <!-- 奖励管理 -->
  <div class="bg-white rounded-2xl shadow-sm border-2 p-5 space-y-4">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <Gift class="text-orange-600" size={22} />
      </div>
      <h3 class="text-lg font-semibold">{$t('settings.rewards')}</h3>
    </div>
    
    <div class="space-y-3">
      <div class="grid grid-cols-1 gap-3">
        <input class="border-2 rounded-lg p-3" placeholder="奖励标题" bind:value={newReward.title} />
        <div class="flex gap-2">
          <input class="border-2 rounded-lg p-3 w-20" type="number" min="1" bind:value={newReward.cost_points} placeholder="消耗" />
          <button type="button" class="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium flex items-center gap-2 flex-1" on:click={() => showRewardIconPicker = !showRewardIconPicker}>
            {#if newReward.icon && getIcon(newReward.icon)?.component}
              <svelte:component this={getIcon(newReward.icon).component} size={18} />
            {:else}
              ➕
            {/if}
            图标
          </button>
          <button type="button" class="px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 flex items-center gap-2" on:click={addRewardAction}>
            <Plus size={18} /> 添加
          </button>
        </div>
        {#if showRewardIconPicker}
          <div class="border-2 rounded-lg p-3">
            <IconPicker 
              selected={newReward.icon} 
              onSelect={(icon) => { 
                newReward = { ...newReward, icon }; 
                showRewardIconPicker = false; 
              }} 
            />
          </div>
        {/if}
      </div>
      
      <div class="space-y-2">
        {#each rewards as r}
          <div class="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
            <div class="flex items-center gap-3 flex-1">
              <!-- 图标 -->
              <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                {#if r.icon && getIcon(r.icon)?.component}
                  <svelte:component this={getIcon(r.icon).component} size={20} class="text-orange-600" />
                {:else}
                  <Gift size={20} class="text-orange-600" />
                {/if}
              </div>
              <!-- 信息 -->
              <div class="flex-1">
                <div class="font-medium">{r.title}</div>
                <div class="text-xs text-rose-600">-{r.cost_points} 积分</div>
              </div>
            </div>
            <!-- 操作 -->
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1 text-sm cursor-pointer">
                <input type="checkbox" checked={r.active===1} on:change={(e) => toggleReward(r.id, (e.target as HTMLInputElement).checked)} class="cursor-pointer" />
                <span>上架</span>
              </label>
              <button type="button" class="p-2 text-rose-600 hover:bg-rose-50 rounded-lg" on:click={() => removeReward(r.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
  
  <!-- 扣分规则 -->
  <div class="bg-white rounded-2xl shadow-sm border-2 p-5 space-y-4">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <AlertCircle class="text-rose-600" size={22} />
      </div>
      <h3 class="text-lg font-semibold">{$t('settings.penalties')}</h3>
    </div>
    
    <div class="space-y-3">
      <div class="grid grid-cols-1 gap-3">
        <input class="border-2 rounded-lg p-3" placeholder="规则标题" bind:value={newPenalty.title} />
        <div class="flex gap-2">
          <select class="border-2 rounded-lg p-3 flex-1" bind:value={newPenalty.mode}>
            <option value="fixed">固定值</option>
            <option value="percent">百分比</option>
          </select>
          <input class="border-2 rounded-lg p-3 w-20" type="number" min="1" bind:value={newPenalty.value} placeholder="值" />
        </div>
        <div class="flex gap-2">
          <button type="button" class="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium flex items-center gap-2 flex-1" on:click={() => showPenaltyIconPicker = !showPenaltyIconPicker}>
            {#if newPenalty.icon && getIcon(newPenalty.icon)?.component}
              <svelte:component this={getIcon(newPenalty.icon).component} size={18} />
            {:else}
              ➕
            {/if}
            图标
          </button>
          <button type="button" class="px-4 py-3 bg-rose-500 text-white rounded-lg font-medium hover:bg-rose-600 flex items-center gap-2" on:click={addPenaltyAction}>
            <Plus size={18} /> 添加
          </button>
        </div>
        {#if showPenaltyIconPicker}
          <div class="border-2 rounded-lg p-3">
            <IconPicker 
              selected={newPenalty.icon} 
              onSelect={(icon) => { 
                newPenalty = { ...newPenalty, icon }; 
                showPenaltyIconPicker = false; 
              }} 
            />
          </div>
        {/if}
      </div>
      
      <div class="space-y-2">
        {#each penalties as p}
          <div class="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
            <div class="flex items-center gap-3 flex-1">
              <!-- 图标 -->
              <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                {#if p.icon && getIcon(p.icon)?.component}
                  <svelte:component this={getIcon(p.icon).component} size={20} class="text-rose-600" />
                {:else}
                  <AlertCircle size={20} class="text-rose-600" />
                {/if}
              </div>
              <!-- 信息 -->
              <div class="flex-1">
                <div class="font-medium">{p.title}</div>
                <div class="text-xs text-rose-600">
                  {p.mode === 'fixed' ? `-${p.value} 积分` : `-${p.value}%`}
                </div>
              </div>
            </div>
            <!-- 操作 -->
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1 text-sm cursor-pointer">
                <input type="checkbox" checked={p.active===1} on:change={(e) => togglePenalty(p.id, (e.target as HTMLInputElement).checked)} class="cursor-pointer" />
                <span>启用</span>
              </label>
              <button type="button" class="p-2 text-rose-600 hover:bg-rose-50 rounded-lg" on:click={() => removePenalty(p.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>
