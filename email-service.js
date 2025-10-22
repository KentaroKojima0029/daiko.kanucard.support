/**
 * メール送信サービス（SMTPフォールバック機能付き）
 *
 * このサービスは以下の戦略でメールを送信します：
 * 1. 直接SMTP送信を試行（タイムアウト: 15秒）
 * 2. 失敗した場合、XserverVPS APIにフォールバック
 * 3. 両方失敗した場合はエラーを返す
 */

const nodemailer = require('nodemailer');
const axios = require('axios');
const logger = require('./logger');

// 環境変数から設定を取得
const VPS_API_URL = process.env.VPS_API_URL || 'https://api.kanucard.com';
const USE_VPS_FALLBACK = process.env.NODE_ENV === 'production'; // 本番環境では常にVPS APIフォールバックを有効化

// Nodemailer transporter設定（Xserver SMTP）
console.log('[email-service] Using Xserver SMTP for email delivery');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'sv10210.xserver.jp',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'contact@kanucard.com',
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3'
  },
  connectionTimeout: 30000,
  greetingTimeout: 20000,
  socketTimeout: 30000,
  logger: process.env.NODE_ENV !== 'production',
  debug: process.env.NODE_ENV !== 'production'
});

/**
 * VPS APIを使用したメール送信（フォールバック）
 */
async function sendViaVPSAPI(mailOptions) {
  logger.info('Attempting to send via VPS API', {
    to: mailOptions.to,
    subject: mailOptions.subject,
    apiUrl: VPS_API_URL
  });

  try {
    const response = await axios.post(
      `${VPS_API_URL}/api/send-email`,
      {
        from: mailOptions.from,
        to: mailOptions.to,
        replyTo: mailOptions.replyTo,
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: mailOptions.text
      },
      {
        timeout: 30000, // 30秒タイムアウト
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info('Email sent successfully via VPS API', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      messageId: response.data.messageId,
      status: response.status
    });

    return {
      success: true,
      method: 'vps-api',
      messageId: response.data.messageId
    };

  } catch (error) {
    const errorMessage = error.response
      ? `API error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`
      : error.message;

    logger.error('VPS API send error', {
      error: errorMessage,
      to: mailOptions.to,
      subject: mailOptions.subject,
      status: error.response?.status,
      data: error.response?.data
    });

    throw new Error(errorMessage);
  }
}

/**
 * 直接SMTP送信を試行
 */
async function sendViaSMTP(mailOptions) {
  console.log('============== SMTP SEND DEBUG ==============');
  console.log('[SMTP] Host:', process.env.SMTP_HOST);
  console.log('[SMTP] Port:', process.env.SMTP_PORT);
  console.log('[SMTP] User:', process.env.SMTP_USER);
  console.log('[SMTP] Pass configured:', !!process.env.SMTP_PASS);
  console.log('[SMTP] From:', mailOptions.from);
  console.log('[SMTP] To:', mailOptions.to);
  console.log('[SMTP] Subject:', mailOptions.subject);
  console.log('==============================================');

  logger.info('Attempting to send via direct SMTP', {
    to: mailOptions.to,
    subject: mailOptions.subject,
    host: process.env.SMTP_HOST
  });

  // Check if credentials are configured
  if (!process.env.SMTP_PASS) {
    const error = new Error('SMTP_PASS not configured');
    console.error('[SMTP] ❌ SMTP_PASS environment variable not set!');
    throw error;
  }

  try {
    const info = await transporter.sendMail(mailOptions);

    console.log('[SMTP] ✅ Email sent successfully');
    console.log('[SMTP] Message ID:', info.messageId);
    console.log('[SMTP] Response:', info.response);

    logger.info('Email sent successfully via SMTP', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      messageId: info.messageId,
      response: info.response
    });

    return {
      success: true,
      method: 'smtp',
      messageId: info.messageId,
      response: info.response
    };

  } catch (error) {
    console.error('============== SMTP ERROR ==============');
    console.error('[SMTP] ❌ Failed to send email');
    console.error('[SMTP] Error type:', error.constructor.name);
    console.error('[SMTP] Error message:', error.message);
    console.error('[SMTP] Error code:', error.code);
    console.error('[SMTP] Error command:', error.command);
    console.error('[SMTP] Error response:', error.response);
    console.error('[SMTP] Error responseCode:', error.responseCode);
    console.error('==========================================');

    logger.error('SMTP send error', {
      error: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    throw error;
  }
}

/**
 * メール送信（フォールバック機能付き）
 *
 * @param {Object} mailOptions - Nodemailerのメールオプション
 * @returns {Promise<Object>} 送信結果
 */
async function sendEmail(mailOptions) {
  const errors = [];

  // ログ: メール送信開始
  console.log('============================================');
  console.log('[email-service] Starting email send process');
  console.log('[email-service] To:', mailOptions.to);
  console.log('[email-service] Subject:', mailOptions.subject);
  console.log('[email-service] Environment:', process.env.NODE_ENV);
  console.log('[email-service] VPS API enabled:', USE_VPS_FALLBACK);
  console.log('[email-service] VPS API URL:', VPS_API_URL);
  console.log('============================================');

  // 本番環境では直接VPS APIを使用（高速化）
  if (USE_VPS_FALLBACK) {
    console.log('[email-service] Production mode: Using VPS API directly...');

    try {
      const result = await sendViaVPSAPI(mailOptions);
      console.log('[email-service] ✓ VPS API send successful');
      return result;
    } catch (apiError) {
      console.error('[email-service] ✗ VPS API failed:', apiError.message);

      errors.push({
        method: 'vps-api',
        error: apiError.message
      });

      logger.error('VPS API send failed', {
        error: apiError.message
      });

      // VPS API失敗時のエラーをそのままスロー
      throw new Error(`VPS API failed: ${apiError.message}`);
    }
  }

  // 開発環境では直接SMTP送信を試行
  console.log('[email-service] Development mode: Attempting direct SMTP send...');
  try {
    const result = await sendViaSMTP(mailOptions);
    console.log('[email-service] ✓ Direct SMTP send successful');
    return result;
  } catch (smtpError) {
    console.error('[email-service] ✗ Direct SMTP send failed:', smtpError.message);
    console.error('[email-service] SMTP error code:', smtpError.code);

    errors.push({
      method: 'direct-smtp',
      error: smtpError.message,
      code: smtpError.code
    });

    logger.error('Direct SMTP send failed', {
      error: smtpError.message,
      code: smtpError.code
    });
  }

  // 3. すべての方法が失敗した場合
  const errorMessage = errors.map(e => `${e.method}: ${e.error}`).join('; ');

  console.error('============================================');
  console.error('[email-service] All email sending methods failed');
  console.error('[email-service] Errors:', JSON.stringify(errors, null, 2));
  console.error('============================================');

  logger.error('All email sending methods failed', {
    to: mailOptions.to,
    subject: mailOptions.subject,
    errors
  });

  throw new Error(`Failed to send email. Attempts: ${errorMessage}`);
}

/**
 * メール送信設定の検証
 */
function validateEmailConfig() {
  const issues = [];

  console.log('============================================');
  console.log('[email-service] Validating email configuration');
  console.log('============================================');

  // Xserver SMTP設定チェック
  console.log('[email-service] Xserver SMTP Configuration:');
  console.log('  - SMTP_HOST:', process.env.SMTP_HOST || 'NOT SET');
  console.log('  - SMTP_PORT:', process.env.SMTP_PORT || 'NOT SET');
  console.log('  - SMTP_USER:', process.env.SMTP_USER || 'NOT SET');
  console.log('  - SMTP_PASS:', process.env.SMTP_PASS ? '****' : 'NOT SET');

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    issues.push('SMTP configuration incomplete');
    console.error('[email-service] ✗ SMTP configuration incomplete!');
  } else {
    console.log('[email-service] ✓ SMTP configuration complete');
  }

  // VPS APIフォールバック設定チェック
  console.log('[email-service] VPS API Fallback Configuration:');
  console.log('  - NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
  console.log('  - USE_VPS_FALLBACK:', USE_VPS_FALLBACK);
  console.log('  - VPS_API_URL:', VPS_API_URL);

  if (USE_VPS_FALLBACK) {
    if (!VPS_API_URL) {
      issues.push('VPS_API_URL not set');
      console.error('[email-service] ✗ VPS_API_URL not set!');
    } else {
      console.log('[email-service] ✓ VPS API fallback configuration complete');
    }
  } else {
    console.warn('[email-service] ⚠ VPS API fallback is DISABLED (development mode)');
    console.warn('[email-service] Will only use direct SMTP in development');
  }

  console.log('============================================');

  if (issues.length > 0) {
    console.error('[email-service] Configuration issues:', issues);
    logger.warn('Email configuration issues detected', { issues });
    return {
      valid: false,
      issues
    };
  }

  console.log('[email-service] ✓ Email configuration valid');
  logger.info('Email configuration validated', {
    smtpConfigured: true,
    fallbackEnabled: USE_VPS_FALLBACK,
    apiConfigured: !!VPS_API_URL
  });

  return {
    valid: true,
    smtpConfigured: true,
    fallbackEnabled: USE_VPS_FALLBACK,
    apiConfigured: !!VPS_API_URL
  };
}

module.exports = {
  sendEmail,
  validateEmailConfig,
  transporter // 後方互換性のためエクスポート
};
