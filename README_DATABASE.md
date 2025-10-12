# PSA代行サービス データベース統合システム

## 概要

このシステムは、PSA代行サービスの管理者側と利用者側のデータを統合管理するためのSQLiteデータベースベースのバックエンドシステムです。

## 主な機能

### ユーザー・管理者データ統合
- **統一データベース**: SQLiteを使用した中央集権的なデータ管理
- **ユーザー管理**: Shopify顧客IDとの連携、メール、電話番号などの一元管理
- **PSA代行依頼管理**: カード情報、進捗状況、料金情報の完全追跡
- **進捗管理**: 6ステップの進捗状況をリアルタイムで追跡
- **メッセージ管理**: ユーザー・管理者間のコミュニケーション履歴
- **買取承認管理**: カード買取の承認フロー管理
- **管理者ログ**: すべての管理者操作を自動記録

### セキュリティ機能
- JWT認証（トークンベース）
- 管理者操作の完全な監査ログ
- IPアドレス記録
- ロールベースアクセス制御

### データバックアップ
- XserverへのFTP自動バックアップ（1時間ごと）
- データベースファイル全体のバックアップ

## データベーススキーマ

### テーブル一覧

#### 1. users (ユーザー管理)
```sql
- id: TEXT PRIMARY KEY
- shopify_id: TEXT UNIQUE
- email: TEXT UNIQUE NOT NULL
- name: TEXT
- phone: TEXT
- total_requests: INTEGER (総依頼数)
- success_rate: REAL (成功率)
- created_at: TEXT
- updated_at: TEXT
```

#### 2. psa_requests (PSA代行依頼)
```sql
- id: TEXT PRIMARY KEY
- user_id: TEXT (外部キー)
- shopify_customer_id: TEXT
- status: TEXT (pending/in_progress/completed)
- progress_step: INTEGER (1-6)
- country: TEXT (usa/japan)
- plan_type: TEXT (value-bulk/economy/standard/express)
- service_type: TEXT
- total_declared_value: INTEGER
- total_estimated_grading_fee: INTEGER
- admin_notes: TEXT
- customer_notes: TEXT
- created_at: TEXT
- updated_at: TEXT
```

#### 3. cards (カード情報)
```sql
- id: TEXT PRIMARY KEY
- request_id: TEXT (外部キー)
- card_name: TEXT
- declared_value: INTEGER (申告価値)
- estimated_grading_fee: INTEGER (予想鑑定料)
- actual_grade: TEXT (実際のグレード)
- grading_fee: INTEGER (実際の鑑定料)
- condition_notes: TEXT
- image_url: TEXT
- created_at: TEXT
```

#### 4. progress_tracking (進捗管理)
```sql
- id: TEXT PRIMARY KEY
- request_id: TEXT (外部キー)
- step_number: INTEGER (1-6)
- step_name: TEXT
- status: TEXT (pending/current/completed)
- updated_by: TEXT (更新者)
- notes: TEXT
- timestamp: TEXT
```

**6ステップの進捗管理:**
1. 申込受付
2. カード受領・検品
3. 代行料お支払い
4. PSA鑑定中
5. 鑑定料お支払い
6. 返送・完了

#### 5. step_details (ステップ詳細データ)
```sql
- id: TEXT PRIMARY KEY
- request_id: TEXT (外部キー)
- step_number: INTEGER
- data: TEXT (JSON形式)
- created_at: TEXT
- updated_at: TEXT
```

#### 6. messages (メッセージ管理)
```sql
- id: TEXT PRIMARY KEY
- request_id: TEXT (外部キー)
- from_user: TEXT
- to_user: TEXT
- message: TEXT
- is_read: INTEGER (0/1)
- created_at: TEXT
```

#### 7. admin_logs (管理者操作ログ)
```sql
- id: TEXT PRIMARY KEY
- admin_user: TEXT
- action: TEXT
- target_request_id: TEXT
- target_user_id: TEXT
- details: TEXT (JSON形式)
- ip_address: TEXT
- timestamp: TEXT
```

#### 8. approvals (買取承認)
```sql
- id: TEXT PRIMARY KEY
- approval_key: TEXT UNIQUE
- customer_name: TEXT
- customer_email: TEXT
- total_price: INTEGER
- status: TEXT
- created_at: TEXT
- updated_at: TEXT
```

#### 9. approval_cards (買取承認カード詳細)
```sql
- id: TEXT PRIMARY KEY
- approval_id: TEXT (外部キー)
- card_name: TEXT
- price: INTEGER
- status: TEXT
- customer_decision: TEXT
- customer_comment: TEXT
```

#### 10. service_status (サービス状況)
```sql
- id: TEXT PRIMARY KEY
- service_id: TEXT UNIQUE
- name: TEXT
- status: TEXT (active/inactive)
- description: TEXT
- last_updated: TEXT
```

#### 11. shipping_schedule (発送スケジュール)
```sql
- id: TEXT PRIMARY KEY
- country: TEXT UNIQUE (usa/japan)
- next_ship_date: TEXT
- notes: TEXT
- last_updated: TEXT
```

## APIエンドポイント

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

利用者サイト (https://new-daiko-form.onrender.com) から利用可能:

- `GET /api/public/service-status` - サービス状況取得
- `GET /api/public/schedule` - 発送スケジュール取得
- `GET /api/public/application/:id/progress` - 申込進捗取得

### ヘルスチェック
- `GET /health` - システムステータス確認

## セットアップ

### 1. 依存関係のインストール
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

### 2. データベース初期化

初回起動時に自動的にデータベースが初期化されます:

```bash
node server.js
```

データベースファイル: `./data/psa_system.db`

### 3. 既存JSONデータのマイグレーション

既存のJSONファイルからSQLiteにデータを移行:

```bash
node migrate-json-to-db.js
```

移行されるデータ:
- applications.json → psa_requests + cards テーブル
- approvals.json → approvals + approval_cards テーブル
- service_status.json → service_status テーブル
- schedule.json → shipping_schedule テーブル

### 4. 環境変数の設定

`.env`ファイルに以下を設定:

```env
# Server
PORT=3000
NODE_ENV=production

# JWT
JWT_SECRET=your-secure-random-string

# SMTP (Xserver)
SMTP_HOST=sv10210.xserver.jp
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=collection@kanucard.com
SMTP_PASS=your-smtp-password

# FTP (Xserver)
FTP_HOST=sv10210.xserver.jp
FTP_USER=your-ftp-username
FTP_PASSWORD=your-ftp-password

# Application
BASE_URL=https://new-daiko-form.onrender.com
```

## 開発

### ローカル開発環境

```bash
NODE_ENV=development npm start
```

開発環境では認証がスキップされ、デフォルト管理者として動作します。

### データベースバックアップ

**自動バックアップ:**
- サーバー起動5秒後に初回バックアップ
- 以降、1時間ごとに自動バックアップ

**手動バックアップ:**
```bash
# データベースファイルをコピー
cp ./data/psa_system.db ./backup/psa_system_$(date +%Y%m%d_%H%M%S).db
```

### データベースの確認

SQLiteコマンドラインツールを使用:

```bash
# データベースに接続
sqlite3 ./data/psa_system.db

# テーブル一覧表示
.tables

# スキーマ表示
.schema users

# データ確認
SELECT * FROM users;
SELECT * FROM psa_requests LIMIT 5;
SELECT * FROM admin_logs ORDER BY timestamp DESC LIMIT 10;

# 終了
.quit
```

## 利用者サイトとの統合

### 利用者サイト側の実装例

```javascript
// 発送スケジュール取得
const response = await fetch('https://kanucard-daiko-support.onrender.com/api/public/schedule');
const data = await response.json();

// サービス状況取得
const statusResponse = await fetch('https://kanucard-daiko-support.onrender.com/api/public/service-status');
const statusData = await statusResponse.json();

// 申込進捗取得
const progressResponse = await fetch(`https://kanucard-daiko-support.onrender.com/api/public/application/${applicationId}/progress`);
const progressData = await progressResponse.json();
```

詳細は `INTEGRATION_GUIDE.md` を参照してください。

## トラブルシューティング

### データベースが作成されない
```bash
# data/ディレクトリの権限確認
ls -la ./data

# 手動でディレクトリ作成
mkdir -p ./data
```

### マイグレーションエラー
```bash
# データベースファイルを削除して再作成
rm ./data/psa_system.db
node server.js
node migrate-json-to-db.js
```

### バックアップが動作しない
- FTP認証情報が正しいか確認
- Xserverの接続制限を確認
- ログを確認: `FTP backup error:` で検索

## パフォーマンス

### インデックス

パフォーマンス最適化のため、以下のインデックスが設定されています:

- `psa_requests`: user_id, status, created_at
- `cards`: request_id
- `progress_tracking`: request_id
- `messages`: request_id, is_read
- `admin_logs`: timestamp
- `approvals`: approval_key

### クエリ最適化

- トランザクションを使用した複数INSERT操作
- WALモード有効化（並行読み書き性能向上）
- prepared statements使用

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
