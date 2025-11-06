# 🔧 修复 404 错误 - 部署指南

## 问题原因

`POST /api/transactions` 返回 404 是因为：
1. ✅ SvelteKit 路由配置拦截了 `/api/*` 请求
2. ✅ Functions 没有被正确部署或识别
3. ⚠️ D1 数据库绑定可能未配置

## 修复步骤

### 1. 更新代码（已完成）

✅ 修改了 `svelte.config.js`：
```javascript
routes: {
  include: ['/*'],
  exclude: ['/api/*']  // 排除 API 路径
}
```

### 2. 重新构建

```bash
npm run build
```

### 3. 重新部署

使用以下任一方式：

**方式 A: 使用 npm 脚本**
```bash
npm run cf:deploy
```

**方式 B: 手动部署**
```bash
npx wrangler pages deploy
```

wrangler 会自动：
- 从 `wrangler.toml` 读取 `pages_build_output_dir`
- 上传 `.svelte-kit/cloudflare` 的内容
- 发现并上传 `functions/` 目录
- 使用项目名 `credits-wall`

### 4. 验证 Functions 部署

部署成功后，在终端查找类似输出：
```
✨ Compiled Worker successfully
✨ Uploading... (XX/XX)
✅ Deployment complete!
```

### 5. 在 Cloudflare Dashboard 绑定 D1

**关键步骤！必须完成！**

1. 访问 https://dash.cloudflare.com
2. 进入 **Pages** → `credits-wall` 项目
3. 点击 **Settings** → **Functions**
4. 滚动到 **D1 database bindings**
5. 点击 **Add binding**：
   - Variable name: `DB`
   - D1 database: 选择 `kids-points-db`
6. 点击 **Save**
7. **重要**：点击页面顶部的 **Retry deployment** 按钮重新部署

### 6. 测试 API

部署完成后，在浏览器控制台测试：

```javascript
// 测试 GET
fetch('https://credits-wall.pages.dev/api/transactions')
  .then(r => r.json())
  .then(console.log);

// 应该返回: { items: [] } 而不是 404
```

## 部署检查清单

- [ ] 修改了 `svelte.config.js` 排除 `/api/*`
- [ ] 运行 `npm run build` 构建成功
- [ ] 运行 `npx wrangler pages deploy` 部署成功
- [ ] 在 Cloudflare Dashboard 绑定了 D1 数据库（变量名: `DB`）
- [ ] 点击 **Retry deployment** 重新部署
- [ ] 测试 API 端点返回正常（不是 404）

## 常见错误

### 错误 1: 仍然返回 404
**原因**: Functions 未被部署
**解决**: 
```bash
# 确保在项目根目录
ls functions/api/transactions.ts  # 应该存在

# 重新部署
npx wrangler pages deploy
```

### 错误 2: D1 database 'DB' not found
**原因**: D1 绑定未配置
**解决**: 参考步骤 5 在 Dashboard 中绑定数据库

### 错误 3: 部署时找不到 pages_build_output_dir
**原因**: 构建未完成或路径错误
**解决**: 
```bash
npm run build
ls -la .svelte-kit/cloudflare  # 确认目录存在
```

## 验证成功

部署成功后，你应该看到：

1. **首页正常加载**
2. **完成任务时**：
   - 控制台显示 `POST /api/transactions` 状态码 200
   - 本地 IndexedDB 更新
   - sync_status 变为 'synced'

3. **历史页面**：
   - 显示交易记录
   - 可以撤销操作

## 下一步

✅ 部署成功后：
1. 初始化数据库：
   ```bash
   wrangler d1 execute kids-points-db --remote --file=./db/schema.sql
   ```

2. 在浏览器控制台同步数据：
   ```javascript
   import { syncAll } from '$lib/sync';
   await syncAll();
   ```

3. 验证数据：
   ```bash
   wrangler d1 execute kids-points-db --remote --command="SELECT * FROM child"
   ```

## 需要帮助？

如果问题仍然存在，请检查：
1. Cloudflare Pages 部署日志
2. 浏览器开发者工具的 Network 面板
3. 确认 `functions/api/transactions.ts` 文件存在且正确

---

**重要提示**: 每次修改 Functions 代码或 D1 绑定后，都需要重新部署！
