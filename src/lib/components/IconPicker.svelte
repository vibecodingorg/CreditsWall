<script lang="ts">
  /**
   * 图标选择器 - 从 lucide-svelte 图标库中选择图标
   */
  import {
    // 任务相关
    BookOpen, Sparkles, Apple, Bike, Music, Palette, Bed, Smile, Heart, Star, Trophy, Target, Zap, Sun,
    // 奖励相关
    IceCream, Candy, Gift, Tv, Gamepad2, Cake, Cookie, Pizza,
    // 运动相关
    Dumbbell,
    // 学习相关
    GraduationCap, Pencil, BookMarked,
    // 家务相关
    Home, Trash2, Shirt, Utensils,
    // 其他
    Coffee, Moon, Cloud, Flame, Droplet
  } from 'lucide-svelte';
  
  export let selected: string | null = null;
  export let onSelect: (icon: string) => void = () => {};
  
  // 图标映射
  const icons = [
    { name: 'sparkles', component: Sparkles, label: '✨ 闪亮' },
    { name: 'book', component: BookOpen, label: '📚 书本' },
    { name: 'apple', component: Apple, label: '🍎 苹果' },
    { name: 'bike', component: Bike, label: '🚲 自行车' },
    { name: 'music', component: Music, label: '🎵 音乐' },
    { name: 'palette', component: Palette, label: '🎨 画板' },
    { name: 'bed', component: Bed, label: '🛏️ 床' },
    { name: 'smile', component: Smile, label: '😊 笑脸' },
    { name: 'heart', component: Heart, label: '❤️ 爱心' },
    { name: 'star', component: Star, label: '⭐ 星星' },
    { name: 'trophy', component: Trophy, label: '🏆 奖杯' },
    { name: 'target', component: Target, label: '🎯 目标' },
    { name: 'zap', component: Zap, label: '⚡ 闪电' },
    { name: 'sun', component: Sun, label: '☀️ 太阳' },
    { name: 'icecream', component: IceCream, label: '🍦 冰淇淋' },
    { name: 'candy', component: Candy, label: '🍬 糖果' },
    { name: 'gift', component: Gift, label: '🎁 礼物' },
    { name: 'tv', component: Tv, label: '📺 电视' },
    { name: 'game', component: Gamepad2, label: '🎮 游戏' },
    { name: 'cake', component: Cake, label: '🎂 蛋糕' },
    { name: 'cookie', component: Cookie, label: '🍪 饼干' },
    { name: 'pizza', component: Pizza, label: '🍕 披萨' },
    { name: 'dumbbell', component: Dumbbell, label: '🏋️ 哑铃' },
    { name: 'football', component: Football, label: '⚽ 足球' },
    { name: 'graduation', component: GraduationCap, label: '🎓 毕业帽' },
    { name: 'pencil', component: Pencil, label: '✏️ 铅笔' },
    { name: 'bookmark', component: BookMarked, label: '📖 书签' },
    { name: 'home', component: Home, label: '🏠 家' },
    { name: 'trash', component: Trash2, label: '🗑️ 垃圾桶' },
    { name: 'shirt', component: Shirt, label: '👕 衣服' },
    { name: 'utensils', component: Utensils, label: '🍴 餐具' },
    { name: 'coffee', component: Coffee, label: '☕ 咖啡' },
    { name: 'moon', component: Moon, label: '🌙 月亮' },
    { name: 'cloud', component: Cloud, label: '☁️ 云' },
    { name: 'flame', component: Flame, label: '🔥 火焰' },
    { name: 'droplet', component: Droplet, label: '💧 水滴' }
  ];
  
  function handleSelect(iconName: string) {
    selected = iconName;
    onSelect(iconName);
  }
</script>

<div class="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-64 overflow-y-auto p-2">
  {#each icons as icon}
    <button
      type="button"
      class="flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all hover:bg-gray-50"
      class:border-blue-500={selected === icon.name}
      class:bg-blue-50={selected === icon.name}
      class:border-gray-200={selected !== icon.name}
      on:click={() => handleSelect(icon.name)}
    >
      <svelte:component this={icon.component} size={28} strokeWidth={2} />
      <span class="text-xs mt-1 text-center leading-tight">{icon.label}</span>
    </button>
  {/each}
</div>
