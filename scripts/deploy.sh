#!/bin/bash

# 快速部署脚本

set -e

echo "🚀 开始部署 Credits Wall"
echo ""

# 检查 wrangler 是否安装
if ! command -v wrangler &> /dev/null
then
    echo "❌ wrangler 未安装"
    echo "请运行: npm install -g wrangler"
    exit 1
fi

# 检查配置文件
if [ ! -f "wrangler.toml" ]; then
    echo "❌ 未找到 wrangler.toml"
    echo "请从 wrangler.toml.example 复制并填写配置"
    exit 1
fi

echo "📦 安装依赖..."
npm install

echo "🔨 构建项目..."
npm run build

echo "📤 部署到 Cloudflare Pages..."
npx wrangler pages deploy .svelte-kit/cloudflare

echo ""
echo "✅ 部署完成！"
echo ""
echo "💡 下一步："
echo "   1. 在 Cloudflare Dashboard 中绑定 D1 数据库"
echo "   2. 访问你的项目 URL"
echo "   3. 在浏览器控制台运行同步："
echo "      import { syncAll } from '\$lib/sync';"
echo "      await syncAll();"
