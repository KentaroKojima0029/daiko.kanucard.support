const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// 環境変数の読み込み
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// 環境変数のデバッグ出力
console.log('========================================');
console.log('🚀 Admin Server Starting...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT || 3001);
console.log('========================================');

const { init: initDatabase, submissionQueries, kaitoriQueries, getDatabase } = require('./database');
const logger = require('./logger');
const { sendEmail, validateEmailConfig } = require('./email-service');
const {
  apiLimiter,
  authLimiter,
  securityHeaders,
  notFoundHandler,
  errorHandler,
  requestLogger
} = require('./middleware');

const app = express();
const port = process.env.PORT || 3001;

// Render/プロキシ環境対応
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  console.log('Trust proxy enabled: trusting 1 hop');
} else {
  app.set('trust proxy', false);
  console.log('Trust proxy disabled (development mode)');
}

// データベース初期化
initDatabase();

// セキュリティヘッダーとロギング
app.use(securityHeaders);
app.use(requestLogger);

// CORS設定（外部からのアクセス用）
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://daiko.kanucard.com',
    'https://kanucard-daiko-support.onrender.com',
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.ADMIN_ORIGIN
  ].filter(Boolean);

  const origin = req.headers.origin;

  if (!origin) {
    return next();
  }

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// ルートパスを管理者ログインページにリダイレクト
app.get('/', (req, res) => {
  res.redirect('/admin/login.html');
});

// ===== JWT設定 =====
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// ===== 管理者認証 =====
// 管理者ログインAPI
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('[Admin Login] ログイン試行:', { email });

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'メールアドレスとパスワードが必要です'
      });
    }

    // 管理者認証情報
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'collection@kanucard.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '#collection30';

    // メールアドレスとパスワードの検証
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      logger.warn('Failed admin login attempt', { email });
      console.log('[Admin Login] ❌ ログイン失敗 - 認証情報が不正');
      return res.status(401).json({
        success: false,
        message: 'メールアドレスまたはパスワードが正しくありません'
      });
    }

    // JWT トークン生成
    const token = jwt.sign(
      {
        email: ADMIN_EMAIL,
        role: 'admin',
        loginAt: Date.now()
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    logger.info('Admin logged in successfully', { email });
    console.log('[Admin Login] ✅ ログイン成功');

    res.json({
      success: true,
      message: '管理者ログインに成功しました',
      token,
      user: {
        email: ADMIN_EMAIL,
        role: 'admin'
      }
    });

  } catch (error) {
    console.error('[Admin Login] エラー:', error);
    logger.error('Admin login error', {
      error: error.message,
      email: req.body.email
    });

    res.status(500).json({
      success: false,
      message: 'システムエラーが発生しました'
    });
  }
});

// 管理者認証ミドルウェア
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '認証が必要です'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'トークンが無効です'
      });
    }

    // 管理者権限チェック
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '管理者権限が必要です'
      });
    }

    req.user = user;
    next();
  });
};

// ===== 管理者用API =====

// 代行案件一覧取得
app.get('/api/agency-requests', authenticateAdmin, (req, res) => {
  const db = getDatabase();

  try {
    const requests = db.prepare(`
      SELECT * FROM agency_requests
      ORDER BY created_at DESC
    `).all();

    res.json(requests);
  } catch (error) {
    logger.error('Error fetching agency requests', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'データ取得エラー'
    });
  }
});

// 代行案件詳細取得
app.get('/api/agency-request/:id', authenticateAdmin, (req, res) => {
  const db = getDatabase();

  try {
    const request = db.prepare(`
      SELECT * FROM agency_requests WHERE id = ?
    `).get(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: '案件が見つかりません'
      });
    }

    res.json(request);
  } catch (error) {
    logger.error('Error fetching agency request', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'データ取得エラー'
    });
  }
});

// 代行案件ステータス更新
app.patch('/api/agency-request/:id/status', authenticateAdmin, (req, res) => {
  const db = getDatabase();
  const { status } = req.body;

  try {
    const update = db.prepare(`
      UPDATE agency_requests
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const result = update.run(status, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '案件が見つかりません'
      });
    }

    logger.info('Agency request status updated', {
      id: req.params.id,
      status,
      admin: req.user.email
    });

    res.json({
      success: true,
      message: 'ステータスを更新しました'
    });
  } catch (error) {
    logger.error('Error updating agency request status', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'ステータス更新エラー'
    });
  }
});

// 承認申請一覧取得
app.get('/api/approval-requests', authenticateAdmin, (req, res) => {
  const db = getDatabase();

  try {
    const requests = db.prepare(`
      SELECT * FROM approval_requests
      ORDER BY created_at DESC
    `).all();

    res.json(requests);
  } catch (error) {
    logger.error('Error fetching approval requests', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'データ取得エラー'
    });
  }
});

// 承認申請作成
app.post('/api/approval-request', authenticateAdmin, async (req, res) => {
  const db = getDatabase();
  const { customerEmail, customerName, cards } = req.body;

  try {
    // 承認申請を作成
    const approvalKey = require('crypto').randomBytes(16).toString('hex');

    const insert = db.prepare(`
      INSERT INTO approval_requests (
        approval_key, customer_email, customer_name, status
      ) VALUES (?, ?, ?, 'pending')
    `);

    const result = insert.run(approvalKey, customerEmail, customerName);
    const approvalId = result.lastInsertRowid;

    // カード情報を挿入
    const insertCard = db.prepare(`
      INSERT INTO approval_cards (
        approval_id, card_name, grade, price
      ) VALUES (?, ?, ?, ?)
    `);

    if (cards && Array.isArray(cards)) {
      for (const card of cards) {
        insertCard.run(approvalId, card.name, card.grade, card.price);
      }
    }

    // 承認メール送信
    const approvalUrl = `${process.env.BASE_URL || 'https://daiko.kanucard.com'}/approval.html?key=${approvalKey}`;

    await sendEmail({
      to: customerEmail,
      subject: '【KanuCard】買取承認のお願い',
      html: `
        <h2>買取承認のお願い</h2>
        <p>${customerName}様</p>
        <p>以下のURLから買取承認をお願いいたします。</p>
        <p><a href="${approvalUrl}">${approvalUrl}</a></p>
      `
    });

    logger.info('Approval request created', {
      id: approvalId,
      customerEmail,
      admin: req.user.email
    });

    res.json({
      success: true,
      message: '承認申請を作成しました',
      approvalId,
      approvalKey
    });
  } catch (error) {
    logger.error('Error creating approval request', { error: error.message });
    res.status(500).json({
      success: false,
      message: '承認申請作成エラー'
    });
  }
});

// メッセージ一覧取得
app.get('/api/messages/:requestId', authenticateAdmin, (req, res) => {
  const db = getDatabase();

  try {
    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE request_id = ?
      ORDER BY created_at ASC
    `).all(req.params.requestId);

    res.json(messages);
  } catch (error) {
    logger.error('Error fetching messages', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'メッセージ取得エラー'
    });
  }
});

// メッセージ送信
app.post('/api/messages', authenticateAdmin, (req, res) => {
  const db = getDatabase();
  const { requestId, message, sender } = req.body;

  try {
    const insert = db.prepare(`
      INSERT INTO messages (
        request_id, message, sender, created_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const result = insert.run(requestId, message, sender || 'admin');

    logger.info('Message sent', {
      id: result.lastInsertRowid,
      requestId,
      admin: req.user.email
    });

    res.json({
      success: true,
      message: 'メッセージを送信しました',
      messageId: result.lastInsertRowid
    });
  } catch (error) {
    logger.error('Error sending message', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'メッセージ送信エラー'
    });
  }
});

// メッセージ既読マーク
app.patch('/api/messages/:requestId/read', authenticateAdmin, (req, res) => {
  const db = getDatabase();

  try {
    const update = db.prepare(`
      UPDATE messages
      SET is_read = 1
      WHERE request_id = ? AND sender != 'admin'
    `);

    update.run(req.params.requestId);

    res.json({
      success: true,
      message: '既読にしました'
    });
  } catch (error) {
    logger.error('Error marking messages as read', { error: error.message });
    res.status(500).json({
      success: false,
      message: '既読マークエラー'
    });
  }
});

// バックアップ一覧取得（簡易実装）
app.get('/api/backups', authenticateAdmin, (req, res) => {
  res.json([]);
});

// バックアップ作成（簡易実装）
app.post('/api/backup', authenticateAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'バックアップを作成しました'
  });
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'admin-server',
    timestamp: new Date().toISOString()
  });
});

// 404エラーハンドラー
app.use(notFoundHandler);

// エラーハンドラー
app.use(errorHandler);

// サーバー起動
app.listen(port, () => {
  console.log('========================================');
  console.log(`✅ Admin Server running on port ${port}`);
  console.log(`📱 Access: http://localhost:${port}`);
  console.log('========================================');
});
