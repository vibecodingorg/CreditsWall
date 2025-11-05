INSERT OR IGNORE INTO reason_catalog (id, code, title, category, is_preset, active, created_at) VALUES
  (lower(hex(randomblob(16))), 'study.homework', '作业', 'study', 1, 1, datetime('now')),
  (lower(hex(randomblob(16))), 'health.brushing', '刷牙', 'health', 1, 1, datetime('now')),
  (lower(hex(randomblob(16))), 'discipline.punctual', '守时', 'discipline', 1, 1, datetime('now')),
  (lower(hex(randomblob(16))), 'chores.cleanroom', '整理房间', 'chores', 1, 1, datetime('now')),
  (lower(hex(randomblob(16))), 'discipline.misbehavior', '不遵守规则', 'discipline', 1, 1, datetime('now')),
  (lower(hex(randomblob(16))), 'study.homework_missing', '作业未完成', 'study', 1, 1, datetime('now')),
  (lower(hex(randomblob(16))), 'health.too_much_screen', '屏幕时间过长', 'health', 1, 1, datetime('now'));
