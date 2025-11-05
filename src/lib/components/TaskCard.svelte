<script lang="ts">
  /**
   * 任务卡片 - 支持长按确认
   * 原则：
   * 1. 触控目标 ≥ 48px
   * 2. 长按 600ms 触发操作
   * 3. 图标 + 文字 + 积分
   * 4. 降级方案（无图标显示 emoji）
   */
  import { getIcon } from '$lib/icons';
  
  export let title: string;
  export let points: number;
  export let icon: string | null = null;
  export let color: string = 'bg-blue-500';
  export let onClick: () => void = () => {};
  export let disabled: boolean = false;
  export let completed: boolean = false;
  export let completedText: string = '已完成';
  
  let timer: any = null;
  let isPressing = false;
  
  const iconData = getIcon(icon);
  
  function onDown() {
    if (disabled) return;
    isPressing = true;
    timer = setTimeout(() => {
      onClick();
      isPressing = false;
    }, 600);
  }
  
  function onUp() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    isPressing = false;
  }
</script>

<button
  class="relative w-full h-28 rounded-2xl text-white flex items-center justify-between px-5 py-4 shadow-md transition-all overflow-hidden {color} {completed ? 'opacity-50' : disabled ? 'opacity-60' : 'hover:scale-105 active:scale-95'}"
  on:mousedown={onDown}
  on:mouseup={onUp}
  on:mouseleave={onUp}
  on:touchstart={onDown}
  on:touchend={onUp}
  on:touchcancel={onUp}
  type="button"
  disabled={disabled || completed}
>
  <!-- 长按进度背景 -->
  {#if isPressing}
    <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
  {/if}
  
  <div class="flex items-center justify-between w-full relative z-10">
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
    
    <!-- 右侧：积分 + 完成状态 -->
    <div class="flex items-center gap-4 flex-shrink-0">
      <!-- 积分 -->
      <div class="text-4xl font-bold leading-none">
        {points > 0 ? '+' : ''}{points}
      </div>
      
      <!-- 完成状态 -->
      {#if completed}
        <span class="text-lg font-bold min-w-[80px] text-right">{completedText}</span>
      {/if}
    </div>
  </div>
</button>
