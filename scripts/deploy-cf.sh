#!/bin/bash

# Cloudflare Pages 部署脚本
# 确保 functions 目录被包含

set -e

echo "🔨 构建项目..."
npm run build

echo "📁 复制 Functions 到构建输出..."
# 创建 functions 目录并复制
cp -r functions .svelte-kit/cloudflare/

echo "📤 部署到 Cloudflare Pages..."
npx wrangler pages deploy .svelte-kit/cloudflare --project-name=credits-wall

echo ""
echo "✅ 部署完成！"
echo ""
echo "🌐 访问: https://credits-wall.pages.dev"
echo ""
echo "💡 接下来："
echo "   1. 确认 D1 绑定已配置（Settings → Functions → D1 bindings）"
echo "   2. 测试 API: fetch('/api/transactions').then(r => r.json())"
