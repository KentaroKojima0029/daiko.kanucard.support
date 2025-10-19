# VPS API経由メール送信機能

## 概要

Render.comからXserver SMTPへの直接接続がブロックされる問題を解決するため、VPS API経由でメール送信を行う機能を実装しました。

## アーキテクチャ

### メール送信フロー

```
┌─────────────────────────────────────────┐
│ Render.com (本番環境)                    │
│                                         │
│  1. sendEmail()呼び出し                  │
│     ↓                                   │
│  2. 直接SMTP接続を試行 (10秒タイムアウト) │
│     ↓ (失敗)                            │
│  3. VPS APIにフォールバック              │
│     └→ POST https://api.kanucard.com    │
│                                         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ VPS (https://api.kanucard.com)         │
│                                         │
│  4. Xserver SMTP経由でメール送信         │
│     └→ sv10210.xserver.jp:587          │
│                                         │
└─────────────────────────────────────────┘
```

## 実装内容

### 1. email-service.js

新規作成したメール送信サービスモジュール。

#### 機能

- **プライマリ: 直接SMTP接続**
  - ローカル環境用
  - タイムアウト: 10秒
  - 失敗時は自動的にVPS APIにフォールバック

- **フォールバック: VPS API経由**
  - 本番環境用
  - エンドポイント: `POST https://api.kanucard.com/api/send-email`
  - タイムアウト: 30秒

#### 主要関数

```javascript
// メール送信（フォールバック付き）
async function sendEmail(mailOptions)

// VPS API経由でメール送信
async function sendEmailViaVPS(mailOptions)

// メール送信テスト
async function testEmailService(toEmail)
```

### 2. server.js の変更

- `nodemailer` の直接使用を削除
- すべてのメール送信を `sendEmail()` に統一（4箇所）
- `transporter` 定義を削除（email-service.jsに移動）

#### 変更箇所

1. `sendMessageEmail()` - 920行目付近
2. `sendApprovalEmail()` - 950行目付近
3. PSA申込管理者通知メール - 1100行目付近
4. PSA申込顧客確認メール - 1150行目付近

### 3. 環境変数

#### 新規追加

```env
VPS_API_URL=https://api.kanucard.com
```

以下のファイルに追加済み：
- `.env`
- `.env.production`
- `.env.example`

## VPS API仕様

### エンドポイント

```
POST https://api.kanucard.com/api/send-email
```

### リクエスト

```json
{
  "to": "recipient@example.com",
  "subject": "件名",
  "text": "プレーンテキスト本文",
  "html": "<p>HTML本文</p>"
}
```

### レスポンス（成功時）

```json
{
  "success": true,
  "messageId": "unique-message-id"
}
```

### レスポンス（失敗時）

```json
{
  "success": false,
  "message": "エラーメッセージ"
}
```

## 使用方法

### 基本的な使い方

```javascript
const { sendEmail } = require('./email-service');

const mailOptions = {
  to: 'customer@example.com',
  subject: 'テストメール',
  text: 'これはテストメールです',
  html: '<p>これは<strong>テストメール</strong>です</p>'
};

try {
  const result = await sendEmail(mailOptions);
  console.log('メール送信成功:', result);
  // { success: true, messageId: 'xxx', method: 'direct-smtp' or 'vps-api' }
} catch (error) {
  console.error('メール送信失敗:', error);
}
```

### テスト

```javascript
const { testEmailService } = require('./email-service');

// テストメール送信
await testEmailService('test@example.com');
```

## ログ出力

詳細なログ出力により、どちらの方法でメールが送信されたかを確認できます：

```
[email-service] Attempting to send email to: customer@example.com
[email-service] Subject: テストメール
[email-service] Environment: production
[email-service] Method 1: Trying direct SMTP...
[email-service] ✗ Direct SMTP failed: Connection timeout
[email-service] Method 2: Falling back to VPS API...
[email-service] Sending email via VPS API
[email-service] VPS API URL: https://api.kanucard.com
[email-service] To: customer@example.com
[email-service] ✓ Email sent via VPS API successfully
```

## トラブルシューティング

### 両方の方法が失敗する場合

```javascript
Error: Failed to send email via all methods.
SMTP: Connection timeout,
VPS: Network error
```

**対処方法：**
1. VPS APIが稼働しているか確認
2. `VPS_API_URL` 環境変数が正しく設定されているか確認
3. ネットワーク接続を確認

### VPS APIエラー

```
[email-service] ✗ VPS API email failed: Request failed with status code 500
[email-service] VPS API response status: 500
[email-service] VPS API response data: { error: '...' }
```

**対処方法：**
1. VPSのログを確認
2. SMTP設定（Xserver）が正しいか確認
3. VPS APIのエンドポイントが正しいか確認

## Render.com環境変数設定

本番環境で以下の環境変数を設定してください：

```env
# メール送信
VPS_API_URL=https://api.kanucard.com
SMTP_USER=contact@kanucard.com
FROM_EMAIL=contact@kanucard.com
SMTP_PASS=your_smtp_password

# Shopify
SHOPIFY_SHOP_NAME=kanucard
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_API_VERSION=2024-10

# その他
JWT_SECRET=fbaa0bd83712c4d525e990c3f98ffe0a481235723b8705d2b5d7c33114d4d111
NODE_ENV=production
```

## デプロイ

### 本番環境

```bash
git push origin main
```

Render.comが自動的にデプロイを開始します（3-5分）。

### デプロイ後の確認

1. Renderのログでエラーがないか確認
2. メール送信機能をテスト
3. ログでどちらの方法が使われたか確認

## 今後の改善案

1. **リトライ機能**
   - VPS API失敗時の自動リトライ
   - エクスポネンシャルバックオフ

2. **メール送信履歴**
   - 送信成功/失敗のログをデータベースに保存
   - 送信方法（SMTP/VPS API）の統計

3. **モニタリング**
   - メール送信失敗時のアラート
   - 送信成功率のモニタリング

4. **キュー機能**
   - 大量メール送信時のキューイング
   - バッチ処理

---
作成日: 2025-10-19
最終更新: 2025-10-19
