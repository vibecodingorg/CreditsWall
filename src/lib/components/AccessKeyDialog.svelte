<script lang="ts">
  export let show = false;
  export let onSubmit: (key: string) => void;
  let keyInput = '';

  function isIOSStandalone(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = (window.navigator as any).standalone === true
      || window.matchMedia('(display-mode: standalone)').matches;
    return isIOS && standalone;
  }

  function submitWithPrompt() {
    const key = window.prompt('请输入访问密码');
    if (!key) return;
    onSubmit(key.trim());
  }

  function submit() {
    const key = keyInput.trim();
    if (!key) return;
    onSubmit(key);
    keyInput = '';
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') show = false;
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="presentation">
    <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" role="dialog" aria-modal="true" tabindex="0" on:keydown={onKeydown}>
      <h3 class="text-lg font-semibold mb-3">输入访问密码</h3>
      <p class="text-sm text-gray-500 mb-4">部署时在服务器端设置的 ACCESS_KEY</p>
      {#if isIOSStandalone()}
        <button
          type="button"
          class="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-medium"
          on:click={submitWithPrompt}
        >
          点击输入访问密码
        </button>
        <p class="text-xs text-gray-400 mt-2">iOS 主屏幕模式下使用系统输入，保证键盘正常弹出</p>
      {:else}
        <div class="flex gap-2">
          <input
            class="border-2 rounded-lg p-3 flex-1 text-base"
            bind:value={keyInput}
            placeholder="访问密码"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            inputmode="text"
          />
          <button type="button" class="px-4 py-3 bg-blue-500 text-white rounded-lg font-medium" on:click={submit}>确定</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
</style>
