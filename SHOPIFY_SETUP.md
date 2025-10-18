# Shopify Integration Setup Guide

## 📋 環境変数の設定

`.env` ファイルに以下のShopify関連の環境変数を設定してください：

### 必須設定項目

```env
# Shopify Configuration
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com          # Shopifyストアドメイン
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your_token             # Storefront APIトークン
SHOPIFY_ADMIN_API_KEY=your_api_key                     # Admin APIキー
SHOPIFY_ADMIN_API_SECRET=your_api_secret               # Admin APIシークレット
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret             # Webhook検証用シークレット

# Shopify Checkout Settings
SHOPIFY_ENABLE_CHECKOUT=true                           # Shopify決済を有効化
SHOPIFY_TEST_MODE=false                                # テストモード（本番はfalse）

# Shopify Product IDs (PSA代行サービス用)
SHOPIFY_PRODUCT_ID_AGENCY=gid://shopify/Product/xxxxx  # 代行サービス商品ID
SHOPIFY_VARIANT_ID_STANDARD=gid://shopify/Variant/xxx  # スタンダードプラン
SHOPIFY_VARIANT_ID_EXPRESS=gid://shopify/Variant/xxxx  # エクスプレスプラン
```

## 🔧 Shopify管理画面での設定

### 1. Private Appの作成

1. Shopify管理画面にログイン
2. 「設定」→「アプリと販売チャンネル」へ移動
3. 「アプリを開発」→「カスタムアプリを作成」
4. 以下の権限を付与：
   - `read_customers`, `write_customers`
   - `read_orders`, `write_orders`
   - `read_draft_orders`, `write_draft_orders`
   - `read_checkouts`, `write_checkouts`
   - `read_products`

### 2. Storefront APIアクセストークンの取得

1. アプリの設定画面で「Storefront API」タブを選択
2. 「Storefront APIアクセストークンを作成」をクリック
3. 以下の権限にチェック：
   - `unauthenticated_read_checkouts`
   - `unauthenticated_write_checkouts`
   - `unauthenticated_read_customers`

### 3. Webhook設定

Shopify管理画面で以下のWebhookを設定：

```
エンドポイント: https://your-domain.com/api/shopify/webhook
イベント:
- checkouts/create
- checkouts/update
- orders/paid
- orders/fulfilled
```

### 4. 商品の作成

PSA代行サービス用の商品を作成：

1. **代行サービス基本料金**
   - 商品名: PSA代行サービス
   - バリエーション:
     - スタンダードプラン
     - エクスプレスプラン

2. **追加手数料商品**（必要に応じて）
   - 鑑定料
   - 送料
   - その他手数料

## 🚀 使用方法

### フロントエンド（JavaScript）

```javascript
// 決済リンクの生成
const paymentLink = await shopifyAPI.createPaymentLink(applicationId, {
    amount: 10000,
    planType: 'standard',
    customerEmail: 'customer@example.com'
});

// 決済ボタンの表示
const buttonHTML = shopifyAPI.generatePaymentButton({
    applicationId: 'APP123',
    amount: 10000,
    buttonText: '今すぐ支払う'
});
document.getElementById('payment-container').innerHTML = buttonHTML;

// 決済状況の確認
await shopifyAPI.displayPaymentStatus('status-container', checkoutId);
```

### バックエンド（Node.js）

```javascript
const shopifyService = require('./services/shopify-service');

// 決済リンクの生成
const paymentUrl = await shopifyService.generatePaymentLink({
    id: applicationId,
    email: customerEmail,
    agencyFee: 5000,
    cards: [...],
    planType: 'standard'
});

// 顧客の同期
const customer = await shopifyService.upsertCustomer({
    email: 'customer@example.com',
    name: '山田太郎',
    phone: '090-1234-5678'
});

// 請求書の作成
const invoice = await shopifyService.createInvoice({
    applicationId: 'APP123',
    customerId: customer.id,
    email: customer.email,
    amount: 15000
});
```

## 📝 テスト環境

開発時は以下の設定でテストモードを使用：

```env
SHOPIFY_TEST_MODE=true
SHOPIFY_ENABLE_CHECKOUT=false  # 実際の決済を無効化
```

この設定により、実際のShopify APIを呼び出さずにモックデータを返します。

## 🔒 セキュリティ注意事項

1. **APIキーの管理**
   - `.env`ファイルは絶対にGitにコミットしない
   - 本番環境では環境変数を使用

2. **Webhook検証**
   - すべてのWebhookリクエストで署名を検証
   - 不正なリクエストは拒否

3. **アクセス制限**
   - Admin APIへのアクセスは管理者のみ
   - Storefront APIは必要最小限の権限のみ

## 📚 参考リンク

- [Shopify Admin API Documentation](https://shopify.dev/api/admin)
- [Shopify Storefront API Documentation](https://shopify.dev/api/storefront)
- [Shopify Checkout API](https://shopify.dev/api/checkout)
- [Webhook Configuration Guide](https://shopify.dev/apps/webhooks)

## ❓ トラブルシューティング

### よくある問題と解決方法

1. **「Invalid API key」エラー**
   - APIキーが正しく設定されているか確認
   - アプリの権限を再確認

2. **チェックアウトが作成できない**
   - 商品IDが正しいか確認
   - Storefront APIの権限を確認

3. **Webhookが受信されない**
   - エンドポイントURLが正しいか確認
   - SSL証明書が有効か確認

4. **決済が完了しない**
   - Shopifyの決済設定を確認
   - テストモードと本番モードの設定を確認

---

設定に関してご不明な点がございましたら、技術サポートまでお問い合わせください。