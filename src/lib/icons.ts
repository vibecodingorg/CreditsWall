/**
 * 图标映射 - 从 icon 字符串到 Lucide 图标组件
 * 原则：
 * 1. 仅导入需要的图标（tree-shakable）
 * 2. 提供降级方案（emoji）
 * 3. 保持简单映射，无复杂逻辑
 */

import {
  // 任务相关
  BookOpen,
  Sparkles,
  Apple,
  Bike,
  Music,
  Palette,
  Bed,
  Smile,
  Heart,
  Star,
  Trophy,
  Target,
  Zap,
  Sun,
  // 奖励相关
  IceCream,
  Candy,
  Gift,
  Tv,
  Gamepad2,
  Cake,
  Cookie,
  Pizza,
  // 导航相关
  Home,
  Store as ShoppingBag,
  History as Clock,
  Settings2,
  // 其他
  Plus,
  Minus,
  Check,
  X,
  ChevronRight,
  AlertCircle,
  Info
} from 'lucide-svelte';

// 导出别名
const Settings = Settings2;

export type IconName = string;

/**
 * 图标映射表
 */
export const iconMap: Record<string, any> = {
  // 任务
  'book': BookOpen,
  'homework': BookOpen,
  'sparkles': Sparkles,
  'clean': Sparkles,
  'apple': Apple,
  'fruit': Apple,
  'bike': Bike,
  'exercise': Bike,
  'music': Music,
  'palette': Palette,
  'art': Palette,
  'bed': Bed,
  'sleep': Bed,
  'smile': Smile,
  'happy': Smile,
  'heart': Heart,
  'love': Heart,
  'star': Star,
  'trophy': Trophy,
  'target': Target,
  'zap': Zap,
  'energy': Zap,
  'sun': Sun,
  
  // 奖励
  'ice-cream': IceCream,
  'candy': Candy,
  'gift': Gift,
  'tv': Tv,
  'video': Tv,
  'game': Gamepad2,
  'gamepad': Gamepad2,
  'cake': Cake,
  'cookie': Cookie,
  'pizza': Pizza,
  
  // 导航
  'home': Home,
  'store': ShoppingBag,
  'shop': ShoppingBag,
  'history': Clock,
  'clock': Clock,
  'settings': Settings,
  'alert': AlertCircle,
  
  // 通用
  'plus': Plus,
  'minus': Minus,
  'check': Check,
  'x': X,
  'close': X,
  'chevron-right': ChevronRight,
  'info': Info
};

/**
 * emoji 降级映射（图标缺失时使用）
 */
export const emojiMap: Record<string, string> = {
  'book': '📚',
  'homework': '📝',
  'sparkles': '✨',
  'clean': '🧹',
  'apple': '🍎',
  'fruit': '🍎',
  'bike': '🚴',
  'exercise': '🏃',
  'music': '🎵',
  'palette': '🎨',
  'art': '🎨',
  'bed': '🛏️',
  'sleep': '😴',
  'smile': '😊',
  'happy': '😊',
  'heart': '❤️',
  'love': '❤️',
  'star': '⭐',
  'trophy': '🏆',
  'target': '🎯',
  'zap': '⚡',
  'energy': '⚡',
  'sun': '☀️',
  'ice-cream': '🍦',
  'candy': '🍬',
  'gift': '🎁',
  'tv': '📺',
  'video': '📺',
  'game': '🎮',
  'gamepad': '🎮',
  'cake': '🎂',
  'cookie': '🍪',
  'pizza': '🍕'
};

/**
 * 获取图标组件或 emoji
 */
export function getIcon(name: string | null | undefined): { component: any; emoji: string } | null {
  if (!name) return null;
  
  const normalized = name.toLowerCase().trim();
  const component = iconMap[normalized];
  const emoji = emojiMap[normalized] || '📌';
  
  return { component, emoji };
}
