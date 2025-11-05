<script lang="ts">
  /**
   * 成功反馈动画 - 彩带/贴纸效果
   * 原则：
   * 1. 轻量纯 CSS 实现
   * 2. 自动消失
   * 3. 可配置类型（success/earn/spend）
   */
  import { onMount } from 'svelte';
  import { Check, Sparkles, Gift } from 'lucide-svelte';
  
  export let show: boolean = false;
  export let type: 'success' | 'earn' | 'spend' = 'success';
  export let message: string = '';
  export let points: number | null = null;
  export let duration: number = 2000;
  export let onClose: () => void = () => {};
  
  let confettiColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94'];
  let confettiPieces = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    color: confettiColors[i % confettiColors.length],
    left: Math.random() * 100,
    delay: Math.random() * 0.5
  }));
  
  $: if (show) {
    const timer = setTimeout(() => {
      show = false;
      onClose();
    }, duration);
  }
  
  function getIcon() {
    if (type === 'earn') return Sparkles;
    if (type === 'spend') return Gift;
    return Check;
  }
  
  function getBgColor() {
    if (type === 'earn') return 'bg-green-500';
    if (type === 'spend') return 'bg-orange-500';
    return 'bg-blue-500';
  }
</script>

{#if show}
  <!-- 彩带背景 -->
  <div class="fixed inset-0 pointer-events-none z-50">
    {#each confettiPieces as piece (piece.id)}
      <div
        class="absolute w-2 h-4 opacity-80"
        style="
          left: {piece.left}%;
          top: -10%;
          background-color: {piece.color};
          animation: confetti-fall 2s ease-out {piece.delay}s forwards;
        "
      ></div>
    {/each}
  </div>
  
  <!-- 成功弹窗 -->
  <div class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
    <div class="animate-success {getBgColor()} text-white rounded-3xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3 pointer-events-auto">
      <svelte:component this={getIcon()} size={56} strokeWidth={2.5} />
      
      {#if points !== null}
        <div class="text-4xl font-bold">
          {points > 0 ? '+' : ''}{points}
        </div>
      {/if}
      
      {#if message}
        <div class="text-lg font-medium">{message}</div>
      {/if}
    </div>
  </div>
{/if}
