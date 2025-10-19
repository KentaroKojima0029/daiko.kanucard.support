/**
 * Email Service with VPS API Fallback
 *
 * メール送信サービス
 * - プライマリ: 直接SMTP接続（ローカル環境用）
 * - フォールバック: VPS API経由（本番環境用）
 */

const axios = require('axios');
const nodemailer = require('nodemailer');

const VPS_API_URL = process.env.VPS_API_URL || 'https://api.kanucard.com';

// Nodemailer transporter（プライマリ - ローカル環境用）
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
  connectionTimeout: 10000, // 10秒（短めに設定してフォールバックを早める）
  greetingTimeout: 10000,
  socketTimeout: 10000,
  logger: process.env.NODE_ENV !== 'production',
  debug: process.env.NODE_ENV !== 'production'
});

/**
 * VPS API経由でメール送信（フォールバック）
 * @param {Object} mailOptions - メールオプション
 * @returns {Promise<Object>} 送信結果
 */
async function sendEmailViaVPS(mailOptions) {
  try {
    console.log('[email-service] Sending email via VPS API');
    console.log('[email-service] VPS API URL:', VPS_API_URL);
    console.log('[email-service] To:', mailOptions.to);

    const response = await axios.post(`${VPS_API_URL}/api/send-email`, {
      to: mailOptions.to,
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      console.log('[email-service] ✓ Email sent via VPS API successfully');
      return {
        success: true,
        messageId: response.data.messageId || 'vps-api-' + Date.now(),
        method: 'vps-api'
      };
    } else {
      throw new Error(response.data.message || 'VPS API returned error');
    }
  } catch (error) {
    console.error('[email-service] ✗ VPS API email failed:', error.message);
    if (error.response) {
      console.error('[email-service] VPS API response status:', error.response.status);
      console.error('[email-service] VPS API response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * メール送信（フォールバック付き）
 * @param {Object} mailOptions - メールオプション
 * @param {string} mailOptions.to - 送信先メールアドレス
 * @param {string} mailOptions.subject - 件名
 * @param {string} [mailOptions.text] - プレーンテキスト本文
 * @param {string} [mailOptions.html] - HTML本文
 * @param {string} [mailOptions.from] - 送信元（オプション）
 * @returns {Promise<Object>} 送信結果
 */
async function sendEmail(mailOptions) {
  console.log('[email-service] Attempting to send email to:', mailOptions.to);
  console.log('[email-service] Subject:', mailOptions.subject);
  console.log('[email-service] Environment:', process.env.NODE_ENV || 'development');

  // 送信元が指定されていない場合はデフォルト値を設定
  if (!mailOptions.from) {
    mailOptions.from = `PSA代行サービス <${process.env.FROM_EMAIL || process.env.SMTP_USER || 'contact@kanucard.com'}>`;
  }

  // 方法1: 直接SMTP接続を試行（ローカル環境で動作）
  try {
    console.log('[email-service] Method 1: Trying direct SMTP...');
    const info = await transporter.sendMail(mailOptions);
    console.log('[email-service] ✓ Direct SMTP succeeded:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
      method: 'direct-smtp'
    };
  } catch (smtpError) {
    console.warn('[email-service] ✗ Direct SMTP failed:', smtpError.message);
    console.log('[email-service] Method 2: Falling back to VPS API...');

    // 方法2: VPS API経由で送信（本番環境で動作）
    try {
      const vpsResult = await sendEmailViaVPS(mailOptions);
      return vpsResult;
    } catch (vpsError) {
      console.error('[email-service] ✗✗ All email methods failed');
      throw new Error(`Failed to send email via all methods. SMTP: ${smtpError.message}, VPS: ${vpsError.message}`);
    }
  }
}

/**
 * メール送信のテスト
 * @param {string} toEmail - テスト送信先
 * @returns {Promise<Object>} テスト結果
 */
async function testEmailService(toEmail = 'test@example.com') {
  console.log('[email-service] Testing email service...');

  const testMailOptions = {
    to: toEmail,
    subject: 'Email Service Test',
    text: 'This is a test email from the email service.',
    html: '<p>This is a <strong>test email</strong> from the email service.</p>'
  };

  try {
    const result = await sendEmail(testMailOptions);
    console.log('[email-service] Test email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('[email-service] Test email failed:', error.message);
    throw error;
  }
}

module.exports = {
  sendEmail,
  sendEmailViaVPS,
  testEmailService
};
