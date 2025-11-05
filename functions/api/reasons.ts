/// <reference types="@cloudflare/workers-types" />

export const onRequestGet: PagesFunction = async () => {
  const defaults = [
    { code: 'study.homework', title: '作业', category: 'study' },
    { code: 'health.brushing', title: '刷牙', category: 'health' },
    { code: 'discipline.punctual', title: '守时', category: 'discipline' },
    { code: 'chores.cleanroom', title: '整理房间', category: 'chores' },
    { code: 'discipline.misbehavior', title: '不遵守规则', category: 'discipline' },
    { code: 'study.homework_missing', title: '作业未完成', category: 'study' },
    { code: 'health.too_much_screen', title: '屏幕时间过长', category: 'health' }
  ];
  return new Response(JSON.stringify({ items: defaults }), { headers: { 'content-type': 'application/json' } });
};
