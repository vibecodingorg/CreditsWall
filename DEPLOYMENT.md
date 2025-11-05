# Cloudflare Workers 部署指南

## 架构概览

```
┌─────────────┐         ┌──────────────────┐         ┌────────────────┐
│   浏览器     │ ←────→  │ Cloudflare Pages │ ←────→  │ Cloudflare D1  │
│  (IndexedDB) │         │   (Workers)      │         │   (SQLite)     │
└─────────────┘         └──────────────────┘         └────────────────┘
     本地优先              API Functions                 云端备份
```

## 新的积分系统

### 数据模型

**Child 表**：
- `total_earned`: 总获得积分（完成任务）
- `total_spent`: 总消费积分（兑换奖励）
- `total_penalty`: 总扣除积分（扣分项）
- 余额计算：`balance = total_earned - total_spent - total_penalty`

**Transaction 表**：
- `type`: `task_complete` | `spend` | `penalty` | `reverse`
- `reversed`: 是否已被撤销
- `reversed_by`: 撤销交易的ID

### API 端点

#### 1. `/api/transactions` - 交易记录

**POST** - 创建交易
```json
{
  "id": "uuid",
  "child_id": "uuid",
  "type": "task_complete",
  "points": 5,
  "notes": "完成 刷牙",
  "reversed": false
}
```

**GET** - 获取交易列表
```
GET /api/transactions?child_id=xxx
```

#### 2. `/api/sync` - 全量同步

**POST** - 上传所有数据
```json
{
  "child": { ... },
  "tasks": [ ... ],
  "rewards": [ ... ],
  "penalties": [ ... ],
  "transactions": [ ... ]
}
```

**GET** - 下载所有数据
```
GET /api/sync?child_id=xxx
```

## 部署步骤

### 1. 安装 Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. 创建 D1 数据库

```bash
# 创建数据库
wrangler d1 create kids-points-db

# 记录输出的 database_id
```

### 3. 更新 wrangler.toml

创建 `wrangler.toml`：

```toml
name = "credits-wall"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "kids-points-db"
database_id = "your-database-id-here"  # 替换为实际 ID

[build]
command = "npm run build"
```

### 4. 初始化数据库

```bash
# 执行 schema
wrangler d1 execute kids-points-db --file=./db/schema.sql

# 检查表结构
wrangler d1 execute kids-points-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### 5. 部署到 Cloudflare Pages

```bash
# 构建项目
npm run build

# 部署（首次）
npx wrangler pages deploy .svelte-kit/cloudflare

# 后续部署
npx wrangler pages deploy .svelte-kit/cloudflare --project-name=credits-wall
```

### 6. 绑定 D1 数据库到 Pages

在 Cloudflare Dashboard:
1. 进入 Pages 项目设置
2. Functions → D1 Bindings
3. 添加变量名 `DB` → 选择数据库 `kids-points-db`

## 开发测试

### 本地开发

```bash
# 启动开发服务器
npm run dev

# 本地 D1 数据库
wrangler d1 execute kids-points-db --local --file=./db/schema.sql
```

### 测试同步

在浏览器控制台：

```javascript
// 导入同步函数
import { syncAll, downloadFromServer } from '$lib/sync';

// 上传所有本地数据到服务器
await syncAll();

// 从服务器下载数据（开发阶段）
await downloadFromServer();
```

## 数据流程

### 正常操作流程

```
1. 用户操作 (完成任务/兑换/扣分)
   ↓
2. 本地 IndexedDB 立即更新
   - 创建 Transaction 记录
   - 更新 Child 统计字段
   - 标记为 sync_status: 'pending'
   ↓
3. 自动同步到服务器
   - POST /api/transactions
   - 服务器更新 D1 数据库
   - 标记为 sync_status: 'synced'
```

### 撤销操作流程

```
1. 用户点击撤销
   ↓
2. 创建撤销交易
   - type: 'reverse'
   - points: -原交易积分
   - ref_id: 原交易ID
   ↓
3. 更新统计
   - 减少对应的 total_* 字段
   - 标记原交易 reversed: true
   ↓
4. 同步到服务器
   - 服务器执行相同逻辑
```

## 数据迁移（开发阶段）

### 清空服务器数据

```bash
wrangler d1 execute kids-points-db --command="
DELETE FROM transaction;
DELETE FROM child;
DELETE FROM task_template;
DELETE FROM reward_item;
DELETE FROM penalty_rule;
"
```

### 全量上传

```javascript
// 在浏览器控制台
import { syncAll } from '$lib/sync';
const result = await syncAll();
console.log(result);
```

### 验证数据

```bash
# 查看 child
wrangler d1 execute kids-points-db --command="SELECT * FROM child"

# 查看交易
wrangler d1 execute kids-points-db --command="SELECT COUNT(*) as count FROM transaction"

# 查看统计
wrangler d1 execute kids-points-db --command="
SELECT 
  name,
  total_earned,
  total_spent,
  total_penalty,
  (total_earned - total_spent - total_penalty) as balance
FROM child
"
```

## 监控和调试

### 查看 Workers 日志

```bash
wrangler pages deployment tail
```

### 调试 D1 查询

```bash
# 查看最近交易
wrangler d1 execute kids-points-db --command="
SELECT type, points, notes, created_at 
FROM transaction 
ORDER BY created_at DESC 
LIMIT 10
"

# 检查撤销记录
wrangler d1 execute kids-points-db --command="
SELECT id, notes, reversed, reversed_by 
FROM transaction 
WHERE type = 'reverse' OR reversed = 1
"
```

## 常见问题

### Q: 本地和服务器数据不一致？
A: 开发阶段可以使用 `downloadFromServer()` 从服务器重新下载数据，会清空本地数据库。

### Q: 同步失败怎么办？
A: 检查网络连接，查看控制台错误信息。同步会自动重试，最多15秒间隔。

### Q: 如何重置所有数据？
A: 
```javascript
// 清空本地
await db.delete();
location.reload();

// 清空服务器
wrangler d1 execute kids-points-db --file=./db/schema.sql --force
```

## 性能优化

### 1. 自动同步策略
- 页面获得焦点时同步
- 网络恢复时同步
- 新交易创建后立即同步

### 2. 批量操作
- 使用 `bulkAdd` 批量插入
- 事务中执行多个更新

### 3. 索引优化
```sql
CREATE INDEX IF NOT EXISTS idx_tx_child_time ON transaction(child_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_idem ON transaction(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_tx_reversed ON transaction(reversed, type);
```

## 下一步

1. ✅ 完成基础同步功能
2. ✅ 实现撤销机制
3. ✅ 统计字段分离
4. 🔄 添加冲突解决策略
5. 📱 离线支持优化
6. 🔐 添加用户认证

## 相关文档

- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Dexie.js](https://dexie.org/)
