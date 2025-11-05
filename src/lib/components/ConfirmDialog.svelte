<script lang="ts">
  /**
   * 确认对话框组件
   */
  import { Check, X } from 'lucide-svelte';
  
  export let show: boolean = false;
  export let title: string = '确认操作';
  export let message: string = '';
  export let confirmText: string = '确定';
  export let cancelText: string = '取消';
  export let onConfirm: () => void = () => {};
  export let onCancel: () => void = () => {};
  
  function handleConfirm() {
    onConfirm();
    show = false;
  }
  
  function handleCancel() {
    onCancel();
    show = false;
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in" on:click={handleCancel}>
    <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-slide-up" on:click|stopPropagation>
      <!-- 标题 -->
      <h3 class="text-xl font-bold mb-3 text-gray-900">{title}</h3>
      
      <!-- 消息 -->
      {#if message}
        <p class="text-gray-600 mb-6 leading-relaxed">{message}</p>
      {/if}
      
      <!-- 按钮 -->
      <div class="flex gap-3">
        <button
          type="button"
          class="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          on:click={handleCancel}
        >
          <X size={20} />
          <span>{cancelText}</span>
        </button>
        <button
          type="button"
          class="flex-1 py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          on:click={handleConfirm}
        >
          <Check size={20} />
          <span>{confirmText}</span>
        </button>
      </div>
    </div>
  </div>
{/if}
