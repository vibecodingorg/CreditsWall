# 儿童积分打卡 PWA（多孩子、单家长、离线优先）

本项目是一款面向家庭的儿童积分打卡 PWA，支持 iPhone/iPad 安装到主屏，离线可用，多孩子管理，商店消费无需审批但需要长按二次确认，奖励可随时增删，支持中文为默认并可切换英文，并可生成图片战报进行分享。目标部署平台为 Cloudflare（Pages + Workers + D1 + KV）。

---

## 1. 设计原则
- 好品味：以“不可变交易流水 + 派生余额”建模，消除临时状态与特殊分支。
- Never break userspace：数据结构与规则升级不影响历史交易；版本化迁移。
- 实用主义：离线优先、本地可用；云端做权威存档与同步；UI 极简大按钮。
- 简洁：函数短小、单一职责；规则计算尽量纯函数、可测试。

---

## 2. 目标与范围（MVP）
- 多孩子、单家长。
- 孩子可自行打卡与消费；商店消费“长按二次确认”。
- 奖励可随时新增、编辑、上下架；不改变历史交易语义。
- 离线优先：无网可打卡/消费/看历史，联网后后台同步。
- 语言：中文默认，支持英文切换（运行时切换并记忆偏好）。
- PWA：可安装到主屏、全屏体验、离线缓存。
- 导出：生成“图片战报”并通过系统分享或保存。

非 MVP（后续）：
- 连续打卡奖励、每日上限；多家长协作；Web Push；账号登录/Passkey；数据导出 CSV。

---

## 3. 角色与权限
- 家长（Parent）：
  - 设置页（PIN 保护）：管理孩子、任务模板、奖励商店、语言切换、数据与同步。
- 孩子（Child）：
  - 孩子主页：打卡与查看余额/本周进度。
  - 商店：浏览奖励并消费（长按 + 确认）。
  - 历史：查看个人流水与“生成战报”。

---

## 4. 页面与导航
- 孩子主页
  - 今日任务网格（大卡片，一触即打卡）。
  - 余额与本周进度环。
  - 顶部快速切换孩子（头像+颜色）。
- 商店（奖励）
  - 奖励网格，低余额灰显；长按触发二次确认；确认后即时扣分。
  - 搜索/分类（可选）。
- 历史
  - 交易流水（打卡/消费/撤销/调整），支持孩子与时间筛选。
  - 按钮：生成战报图片并分享/保存。
- 家长设置（PIN）
  - 孩子管理：头像、昵称、主题色。
  - 任务模板管理：名称、积分、图标、上下架。
  - 奖励管理：名称、消耗积分、图标、上下架。
  - 理由管理：默认理由集合 + 手动新增/编辑/删除；支持分类与代码（reason_category/reason_code），可设常用快捷项。
  - 语言切换：中文/英文。
  - 数据与同步：备份/恢复（后续）。
  - 扣分规则：固定值/比例、基于余额/今日所得/任务分值、取整与备注（家长可增删改）。
- 首次引导
  - 设置家长 PIN -> 创建孩子 -> 选择常用任务/奖励 -> 安装到主屏幕提示卡。

---

## 5. 数据模型（单家长、多孩子）
- child
  - id, name, avatar, color, created_at
- task_template
  - id, title, points, icon, active, created_at
- reward_item
  - id, title, cost_points, icon, active, created_at
- transaction（不可变流水）
  - id(UUID), child_id, type(issue|spend|reverse|adjust), points(signed), ref_id, idempotency_key, created_at, created_by(local_device|parent|child)

要点：
- 余额 = sum(points) by child_id。
- 打卡 = 新增 transaction(type=issue, points>0)。
- 消费 = 新增 transaction(type=spend, points<0)。
- 撤销 = 新增 transaction(type=reverse, points = -original.points, ref_id = original.id)。
- 编辑任务/奖励不回写历史，仅影响后续。

本地 IndexedDB 镜像：child/task_template/reward_item/transaction，附带 sync_status、server_version。

### 扣分与交易扩展（新增）
- 扣分不设上限：允许产生使余额为负的负向交易，账本保持真实；UI 可对负余额做提示。
- 交易新增元数据字段（保留历史可回放与审计）：
  - rule_id（可选）：应用的扣分规则 ID。
  - calc_basis（可选）：比例扣分的基准（current_balance|today_earned|task_points）。
  - calc_snapshot（可选，JSON）：计算当时的快照，例如 {balance: 80, today_earned: 12, task_points: 5}。
  - reason_code（可选）：标准化理由编码（用于统计聚合）。
  - reason_category（可选）：如 discipline/health/study 等分类。
  - tags（可选）：自由标签数组，便于后续更灵活统计。
  - notes（可选）：家长备注。

### penalty_rule（新表）
- 字段：id, title, mode(fixed|percent), value(integer), basis(current_balance|today_earned|task_points), cap(optional), floor(optional), rounding(down|nearest|up), cooldown_sec(optional), active, created_at。
- 比例扣分在创建时即计算为确定的负分，并与 calc_snapshot 一起固化到交易中；云端不重复计算。

### 交易理由与统计分类（新增）
- 加分来源：关联 task_template（issue），天然带有统计语义。
- 扣分来源：
  - 规则驱动：关联 penalty_rule（rule_id）并填写 reason_code/notes。
  - 手动扣分：必须选择 reason_code（从常用理由列表中选），可填 notes。
- 消费来源：关联 reward_item（spend），用于统计消费分布。
- 统计建议：以 reason_code、reason_category、task_template、reward_item 维度聚合；tags 作为灵活扩展维。

### 理由目录（新增）
- 引入 `reason_catalog` 用于管理系统预置与家长自定义的理由：
  - 字段：id, code, title, category, is_preset BOOLEAN, active, created_at
  - 说明：
    - 预置（is_preset=1）为默认内置集合，可编辑启用状态与标题，不建议改 code；
    - 自定义（is_preset=0）由家长手动添加，可编辑/删除；
    - 交易可同时保存 reason_id（指向目录项）与 reason_code（冗余快照，便于历史稳定回放）。
  - 默认分类建议：study、health、discipline、chores、talent；
  - 默认示例 code：
    - study.homework、health.brushing、discipline.punctual、chores.cleanroom、discipline.misbehavior、study.homework_missing、health.too_much_screen。

---

## 6. 交互与儿童友好 UX
- 配色：高饱和主色 + 柔和背景；每个孩子有专属主题色。
- 排版：字号 ≥ 18pt，触控目标 ≥ 48px；高对比度与大留白。
- 图形：卡通图标、简化插画；“成就贴纸”反馈。
- 动效：打卡/消费成功时彩带/弹跳动画；可静音。
- 防误触：
  - 商店消费需“长按二次确认”后再提交交易。
  - 撤销或大额扣分增加弹窗确认。
- 可达性：横竖屏优化；iPad 分屏自适应；离线提示清晰。

---

## 7. PWA 与 iOS/iPadOS 适配
- manifest.json
  - name/short_name、display=standalone、theme_color/background_color。
  - 图标：1024/512/192/180（iOS）。
- Service Worker
  - 静态资源 precache；API runtime 缓存策略：Stale-While-Revalidate。
- 安装引导
  - 检测 Safari PWA 环境；显示“添加到主屏幕”引导卡。
- 存储与性能
  - 历史分段/分页加载；限制资源体积，避免 iOS 存储上限问题。
- Web Push
  - 后续再做（iOS 16.4+ 才较好用）。

---

## 8. 国际化（i18n）
- 默认中文（zh-CN），支持英文（en）。
- 所有文案集中资源文件；运行时切换并持久化用户偏好。
- UI 文案、数字与日期格式本地化处理。

---

## 9. 离线与同步策略
- 前端：
  - 所有操作先写本地 IndexedDB，并产生幂等键（idempotency_key）。
  - 维护“待同步队列”；网络可用时批量 POST 到云端。
- 云端：
  - Workers/D1 端按 idempotency_key 去重；写入成功返回 server_version。
  - 合并策略：时间序 + 最后写入胜出；冲突最小化（不可变流水）。
- 审计与可追溯：流水不可改；撤销以反向交易实现。

---

## 10. 安全与权限
- 家长 PIN：进入设置页需验证；本地安全存储。
- 孩子模式：无需 PIN，但隐藏敏感项（如调整、重置）。
- 篡改防护：余额仅由交易序列派生；谨防直接改余额。
- 隐私：仅存必要最小数据；分享战报需用户手势触发。

---

## 11. 导出图片战报
- 内容：头像与昵称、本周总积分、Top3 任务、完成次数、消费清单、徽章。
- 版式：卡片 3:4 或 1:1，随孩子主题色变；社交友好。
- 实现：
  - 前端渲染“战报组件”，使用 html-to-image/dom-to-image-more 生成 PNG。
  - 若支持 Web Share，使用 navigator.share(files) 分享；否则触发下载或保存相册。
  - iOS PWA 兼容：需用户手势触发（按钮点击）。

---

## 12. 技术栈与架构
- 前端：SvelteKit + TailwindCSS；组件库 Skeleton/shadcn-svelte。
- 本地存储：IndexedDB + Dexie。
- PWA：Vite PWA 插件 + 自定义 Service Worker。
- 国际化：svelte-i18n（zh/en）。
- 云端：Cloudflare Pages（前端）+ Pages Functions/Workers（API）+ D1（SQLite）+ KV（会话/幂等键）。
- 观测：Workers 日志 + Cloudflare Analytics。

API（首版）：
- POST /api/transactions（幂等创建）
- GET /api/transactions?child_id&cursor
- GET /api/balance/:child_id
- GET /api/catalog（任务、奖励）
- PUT /api/catalog/task/:id
- PUT /api/catalog/reward/:id
 - GET /api/penalty-rules
 - POST /api/penalty-rule
 - PUT /api/penalty-rule/:id
 - GET /api/reasons
 - POST /api/reason
 - PUT /api/reason/:id
 - DELETE /api/reason/:id

---

## 13. Cloudflare 部署
- SvelteKit 使用 adapter-cloudflare，部署到 Cloudflare Pages。
- API 使用 Pages Functions/Workers；D1 作为数据库、KV 存会话与幂等键。
- Wrangler 管理本地开发与部署；区分 preview/prod 环境；支持回滚到上一个 Pages 版本。

D1 Schema（首版）：
```sql
CREATE TABLE child (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  color TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE task_template (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  points INTEGER NOT NULL,
  icon TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE reward_item (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cost_points INTEGER NOT NULL,
  icon TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE transaction (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  type TEXT NOT NULL, -- issue | spend | reverse | adjust
  points INTEGER NOT NULL,
  ref_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY(child_id) REFERENCES child(id)
);
CREATE INDEX idx_tx_child_time ON transaction(child_id, created_at);
CREATE INDEX idx_tx_idem ON transaction(idempotency_key);
```

---

## 14. 里程碑（建议）
- M1（2-3天）：确认文案与视觉方向、搭建项目骨架（SvelteKit + Tailwind + PWA + Dexie + i18n）。
- M2（3-5天）：实现孩子主页/商店/历史/设置（PIN）；本地交易与余额派生；图片战报初版。
- M3（3-5天）：Cloudflare API（Workers + D1 + KV）与同步；幂等与分页；部署 preview。
- M4（2天）：iOS 适配优化、性能与边界测试、上线 prod。

---

## 15. 验收标准（MVP）
- iPhone/iPad 可安装到主屏；离线能打卡与消费，联网自动同步。
- 多孩子切换顺畅；余额计算准确，历史可筛选。
- 商店消费需长按二次确认；误触率低。
- 奖励可随时增删改，不影响历史交易。
- 支持中英切换；默认中文。
- 一键生成图片战报，可分享或本地保存。
- Cloudflare Pages/Workers/D1 正常运行，预览与回滚可用。
 - 扣分不设上限；创建时固化计算快照；历史详情可见理由与依据。
 - 每笔加/扣分/消费都有来源：task_template/penalty_rule/manual reason/reward_item；统计维度完整。
  - 理由管理：内置默认理由集合；家长可手动新增/编辑/删除，并在创建交易时可选；历史保留冗余快照不受编辑影响。

---

## 16. 命名与后续
- 暂定项目名：kids-points（可更名）。
- 下一步：初始化项目骨架与 Cloudflare 基建，落地核心页面与同步。
