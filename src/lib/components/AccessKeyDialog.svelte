<script lang="ts">
  export let show = false;
  export let onSubmit: (key: string) => void;
  let keyInput = '';
  function submit() {
    if (!keyInput) return;
    onSubmit(keyInput);
    keyInput = '';
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') show = false;
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" tabindex="0" on:keydown={onKeydown}>
    <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" role="dialog" aria-modal="true" tabindex="0">
      <h3 class="text-lg font-semibold mb-3">输入访问密码</h3>
      <p class="text-sm text-gray-500 mb-4">部署时在服务器端设置的 ACCESS_KEY</p>
      <div class="flex gap-2">
        <input class="border-2 rounded-lg p-3 flex-1" bind:value={keyInput} placeholder="访问密码" />
        <button type="button" class="px-4 py-3 bg-blue-500 text-white rounded-lg font-medium" on:click={submit}>确定</button>
      </div>
    </div>
  </div>
{/if}

<style>
</style>
