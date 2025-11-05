<script lang="ts">
  /**
   * 任务卡片 - 儿童友好的大按钮
   * 原则：
   * 1. 触控目标 ≥ 48px
   * 2. 点击时弹跳动画
   * 3. 图标 + 文字 + 积分
   * 4. 降级方案（无图标显示 emoji）
   */
  import { getIcon } from '$lib/icons';
  
  export let title: string;
  export let points: number;
  export let icon: string | null = null;
  export let color: string = 'bg-blue-500';
  export let onClick: () => void = () => {};
  
  let isAnimating = false;
  
  const iconData = getIcon(icon);
  
  function handleClick() {
    // 触发弹跳动画
    isAnimating = true;
    setTimeout(() => { isAnimating = false; }, 400);
    
    onClick();
  }
</script>

<button
  class="h-28 rounded-2xl text-white flex items-center justify-between px-5 py-4 shadow-md transition-all {color} {isAnimating ? 'animate-bounce' : ''} hover:scale-105 active:scale-95"
  on:click={handleClick}
  type="button"
>
  <!-- 左侧：图标 + 标题 -->
  <div class="flex items-center gap-3 flex-1 min-w-0">
    <!-- 图标或 Emoji -->
    <div class="flex-shrink-0">
      {#if iconData?.component}
        <svelte:component this={iconData.component} size={40} strokeWidth={2.5} />
      {:else if iconData?.emoji}
        <span class="text-4xl leading-none">{iconData.emoji}</span>
      {/if}
    </div>
    
    <!-- 标题 -->
    <div class="text-lg font-bold leading-tight truncate">{title}</div>
  </div>
  
  <!-- 右侧：积分 -->
  <div class="text-4xl font-bold ml-4 flex-shrink-0 leading-none">+{points}</div>
</button>
