# PSA代行買取承認システム

PSAカード代行サービスの買取承認を管理するWebアプリケーションです。

## 機能

### 管理者向け機能
- ログイン認証（JWT）
- 承認申請の作成・管理
- 複数カード対応
- 承認状況の確認
- 統計情報の表示
- Xserverへのデータバックアップ

### 顧客向け機能
- メールで送られた承認URLから承認画面へアクセス
- カードごとの承認・拒否・保留選択
- コメント機能

## 技術スタック

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Database**: JSONファイル（ローカル保存）
- **File Storage**: Xserver (FTP)
- **Email**: Nodemailer (SMTP)
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

### 3. 環境変数の設定

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
ADMIN_EMAIL=collection@kanucard.com
ADMIN_PASSWORD=your-secure-password

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

### 4. ローカル開発

```bash
npm run dev
```

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

1. https://new-daiko-form.onrender.com にアクセス
2. メールアドレスとパスワードでログイン
3. 「新規申請作成」タブで顧客情報とカード情報を入力
4. 送信すると自動的に顧客へメールが送信される

### 顧客

1. メールで受信した承認URLにアクセス
2. カード情報を確認
3. 各カードについて「承認」「拒否」「保留」を選択
4. 必要に応じてコメントを入力
5. 「承認結果を送信」ボタンをクリック

## API エンドポイント

### 認証
- `POST /api/auth/login` - ログイン

### 承認申請
- `POST /api/approval-requests` - 新規作成（要認証）
- `GET /api/approval-requests` - 一覧取得（要認証）
- `GET /api/approval/:key` - 詳細取得（顧客用）
- `POST /api/approval/:key/submit` - 承認結果送信

### 統計
- `GET /api/statistics` - 統計情報取得（要認証）

### ファイル
- `POST /api/upload` - ファイルアップロード（要認証）

## セキュリティ

- JWT認証
- HTTPS通信（本番環境）
- 環境変数による機密情報管理
- セキュリティヘッダー設定

## ライセンス

MIT

## サポート

問題が発生した場合は、GitHubのIssuesで報告してください。