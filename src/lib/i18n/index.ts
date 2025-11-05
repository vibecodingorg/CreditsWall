import { register, init, getLocaleFromNavigator, locale } from 'svelte-i18n';
import { browser } from '$app/environment';

export function setupI18n() {
  register('zh', () => import('./zh.json'));
  register('en', () => import('./en.json'));
  const stored = browser ? localStorage.getItem('lang') : null;
  const nav = browser ? (getLocaleFromNavigator() || '') : '';
  init({
    fallbackLocale: 'zh',
    initialLocale: stored ?? (nav.startsWith('zh') ? 'zh' : 'en')
  });
}

export function setLang(lang: 'zh' | 'en') {
  locale.set(lang);
  if (browser) localStorage.setItem('lang', lang);
}
