#!/bin/bash

echo "🔐 Step 1: ログイン..."
LOGIN_RESPONSE=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"#collection30"}' \
  -s)

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ ログイン失敗"
    echo $LOGIN_RESPONSE | jq '.'
    exit 1
fi

echo "✅ ログイン成功"
echo "トークン取得済み"
echo ""

echo "📋 Step 2: 顧客一覧取得 (モックデータ)..."
CUSTOMERS=$(curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/shopify/customers?mock=true" \
  -s)

SUCCESS=$(echo $CUSTOMERS | jq -r '.success')
if [ "$SUCCESS" != "true" ]; then
    echo "❌ 顧客一覧取得失敗"
    echo $CUSTOMERS | jq '.'
    exit 1
fi

echo "✅ 顧客一覧取得成功"
CUSTOMER_COUNT=$(echo $CUSTOMERS | jq '.data.customers | length')
echo "顧客数: $CUSTOMER_COUNT"

# 最初の顧客情報を表示
echo ""
echo "最初の顧客:"
echo $CUSTOMERS | jq '.data.customers[0] | {id, email, first_name, last_name, orders_count, total_spent}'
echo ""

# 最初の顧客IDを取得
FIRST_CUSTOMER_ID=$(echo $CUSTOMERS | jq -r '.data.customers[0].id')

echo "👤 Step 3: 顧客詳細取得 (ID: $FIRST_CUSTOMER_ID)..."
CUSTOMER_DETAIL=$(curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/shopify/customer?id=$FIRST_CUSTOMER_ID&mock=true" \
  -s)

DETAIL_SUCCESS=$(echo $CUSTOMER_DETAIL | jq -r '.success')
if [ "$DETAIL_SUCCESS" != "true" ]; then
    echo "❌ 顧客詳細取得失敗"
    echo $CUSTOMER_DETAIL | jq '.'
    exit 1
fi

echo "✅ 顧客詳細取得成功"
echo ""
echo "基本情報:"
echo $CUSTOMER_DETAIL | jq '.data.customer | {id, email, first_name, last_name, phone, created_at}'
echo ""
echo "注文履歴:"
ORDER_COUNT=$(echo $CUSTOMER_DETAIL | jq '.data.orders | length')
echo "注文数: $ORDER_COUNT"
if [ "$ORDER_COUNT" -gt 0 ]; then
    echo $CUSTOMER_DETAIL | jq '.data.orders[0] | {order_number, created_at, total_price, financial_status}'
fi
echo ""

echo "🎉 テスト完了！"
echo ""
echo "📝 結果サマリー:"
echo "- ログイン: ✅"
echo "- 顧客一覧取得: ✅ ($CUSTOMER_COUNT 件)"
echo "- 顧客詳細取得: ✅"
echo ""
echo "次のステップ:"
echo "1. ブラウザで http://localhost:3000/admin.html にアクセス"
echo "2. 左メニューから「Shopify顧客管理」をクリック"
echo "3. 顧客の「詳細」ボタンをクリックしてモーダルを確認"