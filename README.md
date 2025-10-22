# KanuCard PSA代行サービス 管理者ダッシュボード

PSAカード代行サービスの管理者専用ダッシュボードです。

## 機能

### 管理者向け機能
- **ログイン認証**: JWT認証による安全なログイン
- **代行案件管理**: 顧客からの代行依頼の管理とステータス更新
- **買取承認管理**: 買取承認の送信と回答管理
- **メッセージ管理**: 顧客とのメッセージ管理
- **統計ダッシュボード**: 案件数や進捗状況の可視化

## 技術スタック

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Database**: SQLite (better-sqlite3)
- **Authentication**: JWT (JSON Web Token)
- **Email**: Nodemailer (SMTP)
- **Deployment**: Render

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`を参考に`.env`ファイルを作成：

```bash
cp .env.example .env
```

必要な環境変数を設定してください。

### 3. ローカル開発

```bash
npm run dev
```

アクセス: http://localhost:3001

### 4. 本番環境へのデプロイ

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

Render.comで環境変数を設定してデプロイしてください。

## API エンドポイント

### 認証
- `POST /api/admin/login` - 管理者ログイン

### 代行案件管理（認証必要）
- `GET /api/agency-requests` - 全案件取得
- `GET /api/agency-request/:id` - 案件詳細取得
- `PATCH /api/agency-request/:id/status` - ステータス更新

### 買取承認管理（認証必要）
- `GET /api/approval-requests` - 全承認申請取得
- `POST /api/approval-request` - 承認申請作成

### メッセージ管理（認証必要）
- `GET /api/messages/:requestId` - メッセージ取得
- `POST /api/messages` - メッセージ送信
- `PATCH /api/messages/:requestId/read` - 既読マーク

### その他
- `GET /health` - ヘルスチェック

## デプロイ先URL

- **本番環境**: https://kanucard-daiko-support.onrender.com
- **利用者サイト**: https://daiko.kanucard.com

## セキュリティ

- JWT認証による管理者認証
- CORS設定による許可されたオリジンのみアクセス可能
- セキュリティヘッダー設定
- 管理者操作ログ記録

## ライセンス

MIT
