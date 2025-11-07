<script lang="ts">
  import '../app.css';
  import { setupI18n, setLang } from '$lib/i18n';
  import { setupAutoSync, ensureAccessAndChild } from '$lib/sync';
  import AccessKeyDialog from '$lib/components/AccessKeyDialog.svelte';
  import { onMount } from 'svelte';
  import { t, waitLocale, locale } from 'svelte-i18n';
  import { page } from '$app/stores';
  import { Home, ShoppingBag, Clock, Settings2 as Settings, Globe, Sparkles } from 'lucide-svelte';
  
  setupI18n();
  
  let showKeyDialog = false;
  function hasKey() { try { return !!localStorage.getItem('ACCESS_KEY'); } catch { return false; } }

  onMount(async () => {
    if (!hasKey()) {
      showKeyDialog = true;
    } else {
      await ensureAccessAndChild();
      setupAutoSync();
    }
    const handler = () => {};
    window.addEventListener('ledger:changed', handler);
    window.addEventListener('sync:status', onSync as any);
    return () => {
      window.removeEventListener('ledger:changed', handler);
      window.removeEventListener('sync:status', onSync as any);
    };
  });

  async function onKeySubmit(key: string) {
    try { localStorage.setItem('ACCESS_KEY', key); } catch {}
    showKeyDialog = false;
    await ensureAccessAndChild();
    setupAutoSync();
  }
  
  let syncStatus: 'idle'|'syncing'|'error'|'offline' = 'idle';
  function onSync(e: CustomEvent) { syncStatus = (e as any).detail?.status || 'idle'; }
  
  let i18nReady = false;
  onMount(async () => { try { await waitLocale(); } finally { i18nReady = true; } });
  
  // 导航项配置
  const navItems = [
    { href: '/', label: 'nav.home', icon: Home },
    { href: '/store', label: 'nav.store', icon: ShoppingBag },
    { href: '/history', label: 'nav.history', icon: Clock },
    { href: '/settings', label: 'nav.settings', icon: Settings }
  ];
  
  function isActive(href: string, currentPath: string | undefined) {
    if (!currentPath) return false;
    if (href === '/') return currentPath === '/';
    return currentPath.startsWith(href);
  }
  
  // 获取当前路径（SSR 安全）
  $: currentPath = typeof window !== 'undefined' ? $page?.url?.pathname : undefined;
</script>

{#if i18nReady}
  <div class="h-screen flex flex-col bg-gray-50">
    <!-- 顶部导航栏 -->
    <header class="bg-white border-b shadow-sm flex-shrink-0">
      <div class="p-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Sparkles class="text-blue-500" size={24} strokeWidth={2.5} />
          <h1 class="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            {$t('app.title')}
          </h1>
        </div>
        <button 
          class="p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
          on:click={() => setLang($locale === 'zh' ? 'en' : 'zh')}
          title="切换语言 / Switch Language"
        >
          <Globe size={20} />
          <span class="text-sm font-medium">{$locale === 'zh' ? '中文' : 'EN'}</span>
        </button>
      </div>
      
      <!-- 同步状态条 -->
      {#if syncStatus !== 'idle'}
        <div class="text-xs text-white px-4 py-1.5 flex items-center gap-2 animate-fade-in"
          class:bg-blue-500={syncStatus==='syncing'}
          class:bg-yellow-500={syncStatus==='offline'}
          class:bg-rose-500={syncStatus==='error'}>
          <div class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
          <span>{syncStatus==='syncing' ? '同步中…' : syncStatus==='offline' ? '离线模式' : '同步出错，将自动重试'}</span>
        </div>
      {/if}
    </header>
    
    <!-- 主内容区 -->
    <main class="flex-1 overflow-y-auto overflow-x-hidden">
      <slot />
    </main>
    
    <!-- 底部导航栏 -->
    <nav class="bg-white border-t shadow-lg flex-shrink-0">
      <div class="grid grid-cols-4">
        {#each navItems as item}
          {@const active = isActive(item.href, currentPath)}
          <a 
            href={item.href}
            class="block py-3 transition-colors hover:bg-gray-50"
            class:text-blue-500={active}
            class:text-gray-600={!active}
          >
            <div class="flex flex-col items-center justify-center gap-1 relative">
              {#if active}
                <div class="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-blue-500 rounded-b-full"></div>
              {/if}
              <svelte:component this={item.icon} size={24} strokeWidth={active ? 2.5 : 2} />
              <span class="text-xs font-medium">{$t(item.label)}</span>
            </div>
          </a>
        {/each}
      </div>
    </nav>
  </div>
{:else}
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
    <div class="text-center">
      <Sparkles class="mx-auto mb-4 text-blue-500 animate-pulse" size={48} />
      <div class="text-gray-500">Loading…</div>
    </div>
  </div>
{/if}
<!-- 访问密码弹窗 -->
<AccessKeyDialog show={showKeyDialog} onSubmit={onKeySubmit} />
