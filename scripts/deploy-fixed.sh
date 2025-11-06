#!/bin/bash

# 正确的 Cloudflare Pages 部署方式
# Functions 需要和构建输出一起部署

set -e

echo "🔨 构建项目..."
npm run build

echo "📤 部署到 Cloudflare Pages（包含 Functions）..."
# 关键：从项目根目录部署，让 wrangler 自动发现：
# - .svelte-kit/cloudflare (构建输出)
# - functions/ (API Functions)
cd "$(dirname "$0")/.."
npx wrangler pages deploy --project-name=credits-wall

echo ""
echo "✅ 部署完成！"
echo ""
echo "🔍 验证："
echo "   curl https://credits-wall.pages.dev/api/transactions"
