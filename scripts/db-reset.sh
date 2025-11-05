#!/bin/bash

# 数据库重置脚本（开发阶段使用）
# 用法: ./scripts/db-reset.sh [database-name]

DB_NAME="${1:-kids-points-db}"

echo "🗑️  清空数据库: $DB_NAME"
echo "⚠️  警告：此操作将删除所有数据！"
read -p "确认继续? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ 操作已取消"
    exit 1
fi

echo "📋 删除所有表..."
wrangler d1 execute $DB_NAME --command="
DROP TABLE IF EXISTS transaction;
DROP TABLE IF EXISTS penalty_rule;
DROP TABLE IF EXISTS reason_catalog;
DROP TABLE IF EXISTS reward_item;
DROP TABLE IF EXISTS task_template;
DROP TABLE IF EXISTS child;
"

echo "🔨 重新创建表结构..."
wrangler d1 execute $DB_NAME --file=./db/schema.sql

echo "✅ 数据库已重置"
echo ""
echo "💡 下一步："
echo "   1. 在浏览器中清空本地数据：localStorage.clear(); indexedDB.deleteDatabase('kids-points')"
echo "   2. 刷新页面，开始使用"
