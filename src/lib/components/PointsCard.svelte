<script lang="ts">
  /**
   * 积分卡片组件 - 统一的积分显示模块
   * 积分计算公式：剩余积分 = 积分总额 - 已使用积分 - 扣分总额
   */
  
  export let balance: number = 0;
  export let totalEarned: number = 0;
  export let totalSpent: number = 0;
  export let totalPenalty: number = 0;
  export let variant: 'default' | 'store' = 'default';
  
  // 根据不同场景使用不同配色
  const gradients = {
    default: 'from-blue-500 to-purple-500',
    store: 'from-orange-500 to-pink-500'
  };
</script>

<div class="bg-gradient-to-r {gradients[variant]} text-white rounded-2xl p-6 shadow-lg">
  <div class="text-sm opacity-90 mb-2">积分统计</div>
  <div class="text-5xl font-bold mb-4">{balance}</div>
  <div class="grid grid-cols-3 gap-4 text-sm opacity-90 border-t border-white/20 pt-3">
    <div>
      <div class="text-xs opacity-75">总积分</div>
      <div class="font-bold">+{totalEarned}</div>
    </div>
    <div>
      <div class="text-xs opacity-75">已使用</div>
      <div class="font-bold">-{totalSpent}</div>
    </div>
    <div>
      <div class="text-xs opacity-75">扣分</div>
      <div class="font-bold">-{totalPenalty}</div>
    </div>
  </div>
  <div class="text-xs opacity-75 mt-3 text-center">
    剩余 = 总积分 - 已使用 - 扣分
  </div>
</div>
