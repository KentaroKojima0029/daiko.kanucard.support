const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const logger = require('./logger');

// ===== レート制限 =====

// 一般的なAPIのレート制限
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 15分間で100リクエストまで
  message: 'リクエストが多すぎます。しばらく待ってから再度お試しください。',
  standardHeaders: true,
  legacyHeaders: false,
  // プロキシ経由の接続を信頼（X-Forwarded-For等のヘッダーを使用）
  trust: true,
  handler: (req, res) => {
    logger.security('Rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'リクエストが多すぎます。しばらく待ってから再度お試しください。'
    });
  }
});

// 認証APIのレート制限
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分
  max: 100, // 1分間で100回まで
  message: '認証試行回数が上限に達しました。しばらく待ってから再度お試しください。',
  skipSuccessfulRequests: true, // 成功したリクエストはカウントしない
  // プロキシ経由の接続を信頼（X-Forwarded-For等のヘッダーを使用）
  trust: true,
  handler: (req, res) => {
    logger.security('Auth rate limit exceeded', {
      ip: req.ip,
      phoneNumber: req.body.phoneNumber
    });
    res.status(429).json({
      error: '認証試行回数が上限に達しました。しばらく待ってから再度お試しください。'
    });
  }
});

// コード検証のレート制限
const verifyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分
  max: 100, // 1分間で100回まで
  message: '認証コードの試行回数が上限に達しました。しばらく待ってから再度お試しください。',
  // プロキシ経由の接続を信頼（X-Forwarded-For等のヘッダーを使用）
  trust: true,
  handler: (req, res) => {
    logger.security('Verify code rate limit exceeded', {
      ip: req.ip,
      phoneNumber: req.body.phoneNumber
    });
    res.status(429).json({
      error: '認証コードの試行回数が上限に達しました。しばらく待ってから再度お試しください。'
    });
  }
});

// ===== 入力値検証 =====

// 電話番号の検証
const validatePhoneNumber = [
  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('電話番号は必須です')
    .matches(/^(0\d{9,10}|\+81\d{9,10})$/).withMessage('有効な電話番号を入力してください'),
];

// 認証コードの検証
const validateVerificationCode = [
  body('code')
    .trim()
    .notEmpty().withMessage('認証コードは必須です')
    .isLength({ min: 6, max: 6 }).withMessage('認証コードは6桁です')
    .isNumeric().withMessage('認証コードは数字のみです'),
];

// メールアドレスの検証
const validateEmail = [
  body('email')
    .trim()
    .notEmpty().withMessage('メールアドレスは必須です')
    .isEmail().withMessage('有効なメールアドレスを入力してください')
    .normalizeEmail(),
];

// 名前の検証
const validateName = [
  body('name')
    .trim()
    .notEmpty().withMessage('名前は必須です')
    .isLength({ min: 1, max: 100 }).withMessage('名前は1〜100文字で入力してください'),
];

// 検証エラーハンドラ
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation error', {
      path: req.path,
      errors: errors.array()
    });
    return res.status(400).json({
      error: errors.array()[0].msg,
      errors: errors.array()
    });
  }
  next();
};

// ===== セキュリティヘッダー =====

const securityHeaders = (req, res, next) => {
  // XSS対策
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.kanucard.com https://kanucard-daiko-support.onrender.com;"
  );

  // HTTPS強制（本番環境のみ）
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

// ===== エラーハンドリング =====

// 404エラーハンドラ
const notFoundHandler = (req, res) => {
  logger.warn('404 Not Found', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  res.status(404).json({
    error: 'リクエストされたリソースが見つかりません'
  });
};

// グローバルエラーハンドラ
const errorHandler = (err, req, res, next) => {
  logger.error('Server error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // エラーの種類に応じて適切なレスポンスを返す
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: '認証が必要です'
    });
  }

  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: '不正なリクエストです'
    });
  }

  // デフォルトのエラーレスポンス
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'サーバーエラーが発生しました'
    : err.message;

  res.status(statusCode).json({
    error: message
  });
};

// ===== リクエストロギング =====

const requestLogger = (req, res, next) => {
  const start = Date.now();

  // レスポンス終了時にログを記録
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.api(
      req.method,
      req.path,
      res.statusCode,
      duration,
      {
        ip: req.ip,
        userAgent: req.get('user-agent')
      }
    );
  });

  next();
};

module.exports = {
  // レート制限
  apiLimiter,
  authLimiter,
  verifyLimiter,

  // 入力値検証
  validatePhoneNumber,
  validateVerificationCode,
  validateEmail,
  validateName,
  handleValidationErrors,

  // セキュリティ
  securityHeaders,

  // エラーハンドリング
  notFoundHandler,
  errorHandler,

  // ロギング
  requestLogger
};
