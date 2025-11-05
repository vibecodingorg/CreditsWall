# 同步系统架构文档

## 概述

Credits Wall 采用**本地优先**架构，使用 IndexedDB 作为主存储，Cloudflare D1 作为云端备份和多设备同步。

## 核心原则

### 1. 本地优先 (Local-First)
- ✅ 所有操作立即在本地完成
- ✅ 无需等待网络响应
- ✅ 离线完全可用
- ✅ 网络恢复后自动同步

### 2. 最终一致性
- 📱 客户端：IndexedDB (Dexie.js)
- ☁️ 服务器：D1 Database (SQLite)
- 🔄 双向同步，冲突最小化

### 3. 幂等性保证
- `idempotency_key`: 保证同一操作不会重复执行
- 服务器检测重复提交，返回成功响应

## 数据模型

### Child (孩子信息)
```typescript
{
  id: string;
  name: string;
  total_earned: number;   // 总获得积分
  total_spent: number;    // 总消费积分
  total_penalty: number;  // 总扣除积分
}

// 余额计算
balance = total_earned - total_spent - total_penalty
```

### Transaction (交易记录)
```typescript
{
  id: string;
  child_id: string;
  type: 'task_complete' | 'spend' | 'penalty' | 'reverse';
  points: number;         // 正数表示增加，负数表示减少
  notes: string;          // 如"完成 刷牙"、"兑换 糖果"
  reversed: boolean;      // 是否已撤销
  reversed_by: string;    // 撤销交易ID
  sync_status: 'pending' | 'synced';
}
```

### TaskTemplate / RewardItem / PenaltyRule
配置数据，本地和服务器都存储，双向同步。

## 同步流程

### 自动同步（Incremental Sync）

```
客户端操作
    ↓
创建 Transaction (sync_status: 'pending')
    ↓
更新本地 Child 统计
    ↓
后台自动同步
    ↓
POST /api/transactions
    ↓
服务器更新 D1
    ↓
更新 sync_status: 'synced'
```

**触发时机**：
- 创建新交易后
- 页面获得焦点
- 网络恢复
- 页面可见状态变化

### 全量同步（Full Sync）

```
客户端
    ↓
收集所有数据 (child, tasks, rewards, penalties, transactions)
    ↓
POST /api/sync
    ↓
服务器 INSERT OR REPLACE
    ↓
标记所有交易为 synced
```

**用途**：
- 首次部署
- 数据迁移
- 强制同步

### 下载同步（Pull Sync）

```
客户端
    ↓
GET /api/sync?child_id=xxx
    ↓
清空本地数据库
    ↓
导入服务器数据
    ↓
标记为 synced
```

**用途**：
- 新设备登录
- 数据恢复
- 开发测试

## API 端点

### POST /api/transactions
创建单个交易记录

**请求**：
```json
{
  "id": "uuid",
  "child_id": "uuid",
  "type": "task_complete",
  "points": 5,
  "notes": "完成 刷牙",
  "idempotency_key": "task-xxx-timestamp",
  "reversed": false
}
```

**响应**：
```json
{
  "ok": true,
  "server_version": 1699123456789
}
```

**服务器逻辑**：
1. 插入 transaction 表
2. 根据 type 更新 child 统计：
   - `task_complete`: `total_earned += points`
   - `spend`: `total_spent += |points|`
   - `penalty`: `total_penalty += |points|`
   - `reverse`: 反向调整 + 标记原交易

### GET /api/transactions
获取交易列表

**请求**：
```
GET /api/transactions?child_id=xxx
```

**响应**：
```json
{
  "items": [...]
}
```

### POST /api/sync
全量上传

**请求**：
```json
{
  "child": {...},
  "tasks": [...],
  "rewards": [...],
  "penalties": [...],
  "transactions": [...]
}
```

### GET /api/sync
全量下载

**响应**：
```json
{
  "ok": true,
  "data": {
    "child": {...},
    "tasks": [...],
    "rewards": [...],
    "penalties": [...],
    "transactions": [...]
  }
}
```

## 撤销机制

### 撤销交易流程

```
1. 用户点击撤销按钮
   ↓
2. 创建撤销交易
   type: 'reverse'
   points: -原交易积分
   ref_id: 原交易ID
   notes: "撤销 完成 刷牙"
   ↓
3. 本地更新
   - 减少对应的 total_* 字段
   - 标记原交易 reversed: true
   - 标记原交易 reversed_by: 撤销交易ID
   ↓
4. 同步到服务器
   - 服务器执行相同逻辑
   - 查询原交易
   - 反向调整统计
   - 标记原交易
```

### 撤销限制

- ✅ 每个交易只能撤销一次
- ✅ 撤销记录本身不能再次撤销
- ✅ 撤销操作不可逆

## 客户端 API

### syncPending()
同步待处理的交易

```typescript
import { syncPending } from '$lib/sync';

// 手动触发同步
await syncPending();
```

### syncAll()
全量上传

```typescript
import { syncAll } from '$lib/sync';

// 上传所有数据到服务器
const result = await syncAll();
if (result.ok) {
  console.log('同步成功');
}
```

### downloadFromServer()
从服务器下载数据

```typescript
import { downloadFromServer } from '$lib/sync';

// 警告：会清空本地数据
const result = await downloadFromServer();
if (result.ok) {
  console.log('下载成功');
  location.reload();
}
```

### setupAutoSync()
设置自动同步

```typescript
import { setupAutoSync } from '$lib/sync';

// 在应用启动时调用一次
onMount(() => {
  setupAutoSync();
});
```

## 错误处理

### 网络错误
- 自动重试，指数退避
- 最大延迟 15 秒
- 网络恢复时立即重试

### 冲突处理
- 使用 `idempotency_key` 防止重复
- 服务器返回 duplicate: true 时视为成功
- 客户端标记为 synced

### 数据完整性
- 所有统计更新在事务中执行
- 服务器端双重检查
- 客户端和服务器逻辑一致

## 监控和调试

### 同步状态事件

```typescript
window.addEventListener('sync:status', (e) => {
  const { status, ...detail } = e.detail;
  console.log('同步状态:', status, detail);
});
```

**状态类型**：
- `idle`: 空闲
- `syncing`: 同步中
- `error`: 错误
- `offline`: 离线

### 调试命令

```javascript
// 查看待同步数量
const pending = await db.transactions.where('sync_status').equals('pending').count();
console.log('待同步:', pending);

// 查看所有交易
const all = await db.transactions.toArray();
console.log('所有交易:', all);

// 查看统计
const child = await db.children.toArray();
console.log('统计:', child);

// 强制同步
import { syncPending } from '$lib/sync';
await syncPending();
```

## 性能优化

### 1. 批量操作
```typescript
// 批量插入交易
await db.transactions.bulkAdd(transactions);
```

### 2. 索引优化
```sql
-- 交易查询优化
CREATE INDEX idx_tx_child_time ON transaction(child_id, created_at);
CREATE INDEX idx_tx_idem ON transaction(idempotency_key);
CREATE INDEX idx_tx_reversed ON transaction(reversed, type);
```

### 3. 限制数量
- 客户端：无限制（IndexedDB 可存储大量数据）
- 服务器：查询最近 200-500 条

### 4. 压缩传输
- 使用 JSON 压缩
- 仅同步必要字段

## 未来优化

### 短期
- [ ] 添加同步进度指示器
- [ ] 优化重试策略
- [ ] 添加同步日志

### 中期
- [ ] 冲突解决策略（时间戳/版本号）
- [ ] 增量下载（仅同步变更）
- [ ] 多用户支持

### 长期
- [ ] 实时同步（WebSocket）
- [ ] P2P 同步
- [ ] 端到端加密

## 相关文件

```
src/lib/
  ├── sync.ts              # 同步逻辑
  └── db/dexie.ts          # 本地数据库

functions/api/
  ├── transactions.ts      # 交易API
  └── sync.ts              # 同步API

db/
  └── schema.sql           # 数据库结构

scripts/
  ├── db-reset.sh          # 重置脚本
  └── deploy.sh            # 部署脚本
```

## 故障排查

### 问题：同步一直失败
**检查**：
1. 网络连接
2. API 端点是否正常
3. D1 数据库是否绑定
4. 查看控制台错误

### 问题：数据不一致
**解决**：
```javascript
// 方案1: 重新同步
await syncAll();

// 方案2: 从服务器恢复
await downloadFromServer();
location.reload();
```

### 问题：撤销失败
**检查**：
1. 交易是否已被撤销
2. 交易类型是否为 reverse
3. 网络是否正常

## 总结

新的同步系统完全基于最新的本地积分系统重构，核心特性：

✅ **分离统计**：total_earned, total_spent, total_penalty
✅ **撤销支持**：reversed, reversed_by 字段
✅ **幂等性**：idempotency_key 防重复
✅ **自动同步**：后台自动、智能重试
✅ **双向同步**：上传/下载灵活
✅ **开发友好**：脚本工具、详细文档
