const fs = require('fs');
const path = require('path');

// ログレベル
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

// 本番環境かどうか
const isProduction = process.env.NODE_ENV === 'production';

// ログディレクトリ
const LOG_DIR = path.join(__dirname, 'logs');

// ログディレクトリが存在しない場合は作成
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ログファイルパス
const getLogFilePath = (type) => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(LOG_DIR, `${type}-${date}.log`);
};

// ログフォーマット
function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
  return `[${timestamp}] [${level}] ${message} ${metaString}\n`;
}

// ファイルにログを書き込む
function writeToFile(level, message, meta) {
  if (!isProduction) return; // 開発環境ではファイルに書き込まない

  const logFile = getLogFilePath(level.toLowerCase());
  const logEntry = formatLog(level, message, meta);

  fs.appendFile(logFile, logEntry, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });

  // すべてのログをcombined.logにも書き込む
  const combinedFile = getLogFilePath('combined');
  fs.appendFile(combinedFile, logEntry, () => {});
}

// ロガー本体
const logger = {
  error: (message, meta = {}) => {
    console.error(`[ERROR] ${message}`, meta);
    writeToFile(LOG_LEVELS.ERROR, message, meta);
  },

  warn: (message, meta = {}) => {
    console.warn(`[WARN] ${message}`, meta);
    writeToFile(LOG_LEVELS.WARN, message, meta);
  },

  info: (message, meta = {}) => {
    console.log(`[INFO] ${message}`, meta);
    writeToFile(LOG_LEVELS.INFO, message, meta);
  },

  debug: (message, meta = {}) => {
    if (!isProduction) {
      console.log(`[DEBUG] ${message}`, meta);
    }
    writeToFile(LOG_LEVELS.DEBUG, message, meta);
  },

  // セキュリティ関連のログ
  security: (message, meta = {}) => {
    const securityMeta = { ...meta, type: 'SECURITY' };
    console.warn(`[SECURITY] ${message}`, securityMeta);
    writeToFile('SECURITY', message, securityMeta);
  },

  // API呼び出しのログ
  api: (method, endpoint, status, duration, meta = {}) => {
    const apiMeta = {
      ...meta,
      method,
      endpoint,
      status,
      duration: `${duration}ms`
    };
    logger.info(`API ${method} ${endpoint} - ${status}`, apiMeta);
  }
};

module.exports = logger;
