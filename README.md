# PSA代行サービス 総合管理システム

PSAカード代行サービスのユーザー・管理者データを統合管理するWebアプリケーションです。

## 機能

### ユーザー・管理者データ統合
- **統一データベース**: SQLiteを使用した中央集権的なデータ管理
- **ユーザー管理**: Shopify顧客IDとの連携、メール、電話番号などの一元管理
- **PSA代行依頼管理**: カード情報、進捗状況、料金情報の完全追跡
- **進捗管理**: 6ステップの進捗状況をリアルタイムで追跡
- **メッセージ管理**: ユーザー・管理者間のコミュニケーション履歴
- **買取承認管理**: カード買取の承認フロー管理
- **管理者ログ**: すべての管理者操作を自動記録

### 管理者向け機能
- JWT認証とロールベースアクセス制御
- PSA代行申込の作成・更新・削除
- 進捗ステータスの更新
- 承認申請の作成・管理
- 統計情報とダッシュボード
- メッセージ送受信
- 管理者操作ログの確認
- Xserverへの自動データバックアップ

### 顧客向け機能
- PSA代行申込の進捗確認
- メッセージ送受信
- 買取承認画面（メール経由）
- カードごとの承認・拒否・保留選択
- サービス状況・発送スケジュール確認

## 技術スタック

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Database**: SQLite (better-sqlite3) with WAL mode
- **File Storage**: Xserver (FTP)
- **Email**: Nodemailer (SMTP)
- **Authentication**: JWT (JSON Web Token)
- **Deployment**: Render

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/KentaroKojima0029/kanucard-daiko-support.git
cd kanucard-daiko-support
```

### 2. 依存関係のインストール

```bash
npm install
```

必要なパッケージ:
- `better-sqlite3` - SQLiteデータベース
- `express` - Webフレームワーク
- `jsonwebtoken` - JWT認証
- `bcrypt` - パスワードハッシュ化
- `nodemailer` - メール送信
- `basic-ftp` - FTPバックアップ
- その他（package.json参照）

### 3. データベース初期化

初回起動時に自動的にデータベースが初期化されます：

```bash
node server.js
```

データベースファイル: `./data/psa_system.db`

### 4. 既存JSONデータのマイグレーション（初回のみ）

既存のJSONファイルからSQLiteにデータを移行:

```bash
node migrate-json-to-db.js
```

移行されるデータ:
- applications.json → psa_requests + cards テーブル
- approvals.json → approvals + approval_cards テーブル
- service_status.json → service_status テーブル
- schedule.json → shipping_schedule テーブル

### 5. 環境変数の設定

`.env.example`を参考に`.env`ファイルを作成：

```bash
cp .env.example .env
```

必要な環境変数を設定：

```env
# Server
PORT=3000
NODE_ENV=production

# JWT
JWT_SECRET=your-secure-random-string

# Admin
ADMIN_EMAIL=contact@kanucard.com
ADMIN_PASSWORD=your-secure-password

# SMTP (Xserver)
SMTP_HOST=sv10210.xserver.jp
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=contact@kanucard.com
SMTP_PASS=your-smtp-password

# FTP (Xserver)
FTP_HOST=sv10210.xserver.jp
FTP_USER=your-ftp-username
FTP_PASSWORD=your-ftp-password

# Application
BASE_URL=https://kanucard-daiko-support.onrender.com
```

### 6. ローカル開発

```bash
npm run dev
# または
NODE_ENV=development node server.js
```

開発環境では認証がスキップされ、デフォルト管理者として動作します。

アクセス: http://localhost:3000

## Renderへのデプロイ

### 1. GitHubへプッシュ

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Renderでの設定

1. [Render](https://render.com)にログイン
2. 「New +」→「Web Service」を選択
3. GitHubリポジトリを接続
4. 環境変数を設定（Renderダッシュボードから）
5. デプロイ

### 3. 環境変数の設定（Renderダッシュボード）

以下の環境変数をRenderのダッシュボードで設定：

- `ADMIN_PASSWORD`: 管理者パスワード
- `SMTP_PASS`: SMTPパスワード
- `FTP_USER`: FTPユーザー名（必要な場合）
- `FTP_PASSWORD`: FTPパスワード（必要な場合）

## 使用方法

### 管理者

1. https://kanucard-daiko-support.onrender.com にアクセス
2. メールアドレスとパスワードでログイン
3. PSA代行申込の作成・管理
4. 進捗ステータスの更新
5. 買取承認の作成と管理
6. ユーザーとのメッセージ送受信
7. 統計情報とダッシュボードの確認
8. 管理者ログの確認

### 顧客（利用者サイト経由）

1. PSA代行申込の進捗確認
2. メッセージ送受信
3. メールで受信した買取承認URLにアクセス
4. カード情報を確認
5. 各カードについて「承認」「拒否」「保留」を選択
6. 必要に応じてコメントを入力
7. 「承認結果を送信」ボタンをクリック

## API エンドポイント

### 管理者用API（認証必要）

#### ユーザー管理
- `GET /api/users` - 全ユーザー取得
- `GET /api/users/:userId` - ユーザー詳細取得
- `POST /api/users` - ユーザー作成

#### PSA代行申込管理
- `GET /api/applications` - 全申込取得
- `GET /api/applications/:id` - 申込詳細取得
- `POST /api/applications` - 新規申込作成
- `PUT /api/applications/:id` - 申込更新
- `DELETE /api/applications/:id` - 申込削除

#### 進捗管理
- `GET /api/progress` - 全進捗取得
- `GET /api/progress/:applicationId` - 申込別進捗取得
- `PUT /api/progress/:applicationId/step/:stepId` - ステップ更新

#### メッセージ管理
- `GET /api/messages` - 全メッセージ取得
- `POST /api/messages` - メッセージ送信
- `PUT /api/messages/:id/read` - 既読マーク

#### 買取承認管理
- `GET /api/approvals` - 全承認取得
- `POST /api/approvals` - 新規承認作成

#### サービス状況管理
- `GET /api/service-status` - サービス状況取得
- `PUT /api/service-status` - サービス状況更新

#### 発送スケジュール管理
- `GET /api/schedule` - スケジュール取得
- `PUT /api/schedule` - スケジュール更新

#### 統計情報
- `GET /api/statistics` - 統計情報取得

#### 管理者ログ
- `GET /api/admin/logs?limit=100` - 管理者ログ取得

### 公開API（認証不要・CORS対応）

利用者サイト (https://daiko.kanucard.com) から利用可能:

- `GET /api/public/service-status` - サービス状況取得
- `GET /api/public/schedule` - 発送スケジュール取得
- `GET /api/public/application/:id/progress` - 申込進捗取得

### ヘルスチェック
- `GET /health` - システムステータス確認

詳細なAPI仕様は `README_DATABASE.md` を参照してください。

## データベース

### スキーマ

システムは以下の11テーブルで構成されています：

1. **users** - ユーザー管理
2. **psa_requests** - PSA代行依頼
3. **cards** - カード情報
4. **progress_tracking** - 進捗管理（6ステップ）
5. **step_details** - ステップ詳細データ
6. **messages** - メッセージ管理
7. **admin_logs** - 管理者操作ログ
8. **approvals** - 買取承認
9. **approval_cards** - 買取承認カード詳細
10. **service_status** - サービス状況
11. **shipping_schedule** - 発送スケジュール

詳細なスキーマ定義は `README_DATABASE.md` を参照してください。

### バックアップ

**自動バックアップ:**
- サーバー起動5秒後に初回バックアップ
- 以降、1時間ごとに自動バックアップ
- Xserver FTPへアップロード

**手動バックアップ:**
```bash
cp ./data/psa_system.db ./backup/psa_system_$(date +%Y%m%d_%H%M%S).db
```

## 利用者サイトとの統合

利用者サイト (https://daiko.kanucard.com) との統合方法については `INTEGRATION_GUIDE.md` を参照してください。

## セキュリティ

### 実装済みセキュリティ対策

1. **JWT認証**: トークンベースの認証
2. **管理者ログ**: 全操作の監査ログ
3. **IPアドレス記録**: 操作元の追跡
4. **SQLインジェクション対策**: prepared statements使用
5. **CORS設定**: 許可されたオリジンのみアクセス可能
6. **セキュリティヘッダー**: X-Frame-Options, X-XSS-Protection等

### 推奨事項

- 本番環境では必ずJWT_SECRETを変更
- 定期的なデータベースバックアップ
- 管理者ログの定期的な確認
- 不審なアクセスの監視

## ライセンス

MIT

## サポート

問題が発生した場合は、GitHubのIssuesで報告してください。