<script lang="ts">
  /**
   * 奖励卡片 - 支持长按二次确认
   * 原则：
   * 1. 长按 600ms 触发确认
   * 2. 进度环视觉反馈
   * 3. 余额不足灰显
   * 4. 防误触
   */
  import { getIcon } from '$lib/icons';
  
  export let title: string;
  export let cost: number;
  export let icon: string | null = null;
  export let color: string = 'bg-rose-500';
  export let disabled: boolean = false;
  export let onLongPress: () => void = () => {};
  
  let timer: any = null;
  let isPressing = false;
  
  const iconData = getIcon(icon);
  
  function onDown() {
    if (disabled) return;
    isPressing = true;
    timer = setTimeout(() => {
      onLongPress();
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
  class="relative h-32 rounded-2xl text-white flex items-center justify-between px-5 py-4 shadow-md transition-all overflow-hidden {disabled ? 'bg-gray-400 opacity-60' : color} {disabled ? '' : 'hover:scale-105 active:scale-95'}"
  on:mousedown={onDown}
  on:mouseup={onUp}
  on:mouseleave={onUp}
  on:touchstart={onDown}
  on:touchend={onUp}
  on:touchcancel={onUp}
  type="button"
  {disabled}
>
  <!-- 长按进度背景 -->
  {#if isPressing}
    <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
  {/if}
  
  <!-- 左侧：图标 + 标题 -->
  <div class="flex items-center gap-3 flex-1 min-w-0 relative z-10">
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
  
  <!-- 右侧：消耗积分 -->
  <div class="text-4xl font-bold ml-4 flex-shrink-0 relative z-10 leading-none">-{cost}</div>
  
  <!-- 提示文字 - 绝对定位在左下角 -->
  {#if !disabled && !isPressing}
    <div class="absolute bottom-3 left-5 text-xs opacity-75 z-10">长按兑换</div>
  {/if}
</button>
