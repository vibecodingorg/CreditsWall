# 积分系统集成测试

## 积分计算公式
```
剩余积分 = 积分总额(total_earned) - 已使用积分(total_spent) - 扣分总额(total_penalty)
balance = totalEarned - totalSpent - totalPenalty
```

## 测试场景

### 1. 完成任务 ✅
**操作**：长按任务卡片 → 确认完成
**数据变化**：
- `total_earned` +5 (假设任务5分)
- `total_spent` 不变
- `total_penalty` 不变
- `balance` = totalEarned - totalSpent - totalPenalty

**函数调用**：
```typescript
completeTask(childId, taskId, points)
  → updateChildStats(childId, +points, 0, 0)
  → total_earned += points
```

---

### 2. 兑换商品 🎁
**操作**：长按商品卡片 → 确认兑换
**数据变化**：
- `total_earned` 不变
- `total_spent` +10 (假设商品10分)
- `total_penalty` 不变
- `balance` 减少 10

**函数调用**：
```typescript
redeemReward(childId, rewardId, cost, title)
  → updateChildStats(childId, 0, +cost, 0)
  → total_spent += cost
```

---

### 3. 执行扣分 ⚠️
**操作**：长按扣分项 → 确认扣分
**数据变化**：
- `total_earned` 不变
- `total_spent` 不变
- `total_penalty` +3 (假设扣3分)
- `balance` 减少 3

**函数调用**：
```typescript
applyPenalty(childId, penaltyId, points, title)
  → updateChildStats(childId, 0, 0, +points)
  → total_penalty += points
```

---

## 完整测试流程

### 初始状态
```
total_earned: 0
total_spent: 0
total_penalty: 0
balance: 0
```

### Step 1: 完成任务 (+5分)
```
total_earned: 5
total_spent: 0
total_penalty: 0
balance: 5
```

### Step 2: 完成任务 (+10分)
```
total_earned: 15
total_spent: 0
total_penalty: 0
balance: 15
```

### Step 3: 兑换商品 (-8分)
```
total_earned: 15
total_spent: 8
total_penalty: 0
balance: 7
```

### Step 4: 执行扣分 (-3分)
```
total_earned: 15
total_spent: 8
total_penalty: 3
balance: 4
```

### Step 5: 完成任务 (+5分)
```
total_earned: 20
total_spent: 8
total_penalty: 3
balance: 9
```

---

## 验证要点

✅ **PointsCard 显示正确**
- 剩余积分 = balance
- 总积分 = total_earned
- 已使用 = total_spent
- 扣分 = total_penalty

✅ **数据持久化**
- 所有操作都保存到 IndexedDB
- 刷新页面后数据不丢失

✅ **交易记录完整**
- 每个操作都创建对应的 Transaction 记录
- type: 'task_complete' | 'spend' | 'penalty'
- ref_id 正确关联到任务/商品/扣分项

✅ **三个模块独立统计**
- 任务完成只影响 total_earned
- 商品兑换只影响 total_spent
- 扣分项只影响 total_penalty

---

## 已修复的问题

1. ✅ 商店兑换函数从 `addTransaction` 改为 `redeemReward`
2. ✅ 移除旧的 `ledger:changed` 事件监听
3. ✅ 所有页面统一使用 `PointsCard` 组件
4. ✅ 积分计算公式统一在 `getChildStats` 中实现
