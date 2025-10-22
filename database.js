const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'daiko.db'));

// データベース初期化
function initDatabase() {
  // ユーザーテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      phone_number TEXT UNIQUE,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 認証コードテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      verified BOOLEAN DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 代行依頼テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS form_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      plan TEXT NOT NULL,
      service_option TEXT NOT NULL,
      purchase_offer TEXT,
      return_method TEXT,
      inspection_option TEXT,
      items TEXT NOT NULL,
      total_quantity INTEGER,
      total_declared_value REAL,
      total_acquisition_value REAL,
      total_fee TEXT,
      estimated_tax TEXT,
      estimated_grading_fee TEXT,
      total_estimated_fee TEXT,
      message TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // セッショ���テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // お問い合わせテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 注文進捗テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL UNIQUE,
      current_step INTEGER DEFAULT 1,
      step1_status TEXT DEFAULT 'completed',
      step1_completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      step1_details TEXT,
      step2_status TEXT DEFAULT 'pending',
      step2_completed_at DATETIME,
      step2_details TEXT,
      step3_status TEXT DEFAULT 'pending',
      step3_completed_at DATETIME,
      step3_details TEXT,
      step4_status TEXT DEFAULT 'pending',
      step4_completed_at DATETIME,
      step4_details TEXT,
      step5_status TEXT DEFAULT 'pending',
      step5_completed_at DATETIME,
      step5_details TEXT,
      step6_status TEXT DEFAULT 'pending',
      step6_completed_at DATETIME,
      step6_details TEXT,
      tracking_number TEXT,
      psa_submission_date DATETIME,
      psa_tracking_number TEXT,
      estimated_completion_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES form_submissions(id)
    )
  `);

  // 決済情報テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      payment_type TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_method TEXT,
      payment_date DATETIME,
      receipt_url TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES form_submissions(id)
    )
  `);

  // 進捗履歴テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS progress_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      step_number INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES form_submissions(id)
    )
  `);

  // 通知履歴テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      user_id INTEGER,
      notification_type TEXT NOT NULL,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      sent_at DATETIME,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES form_submissions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 買取依頼テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS kaitori_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      card_name TEXT NOT NULL,
      card_condition TEXT,
      card_image_url TEXT,
      assessment_price REAL,
      assessment_comment TEXT,
      assessor_name TEXT,
      assessment_date DATETIME,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT,
      status TEXT DEFAULT 'pending',
      response_type TEXT,
      response_date DATETIME,
      bank_name TEXT,
      bank_branch TEXT,
      account_number TEXT,
      account_holder TEXT,
      return_method TEXT,
      valid_until DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Database initialized successfully');
}

// クエリオブジェクトを初期化（遅延初期化）
let userQueries = null;
let verificationQueries = null;
let submissionQueries = null;
let sessionQueries = null;
let contactQueries = null;
let progressQueries = null;
let paymentQueries = null;
let progressHistoryQueries = null;
let notificationQueries = null;
let kaitoriQueries = null;

function initQueries() {
  if (userQueries) return; // Already initialized

  userQueries = {
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),
  findByPhoneNumber: db.prepare('SELECT * FROM users WHERE phone_number = ?'),
  create: db.prepare(`
    INSERT INTO users (email, phone_number, name)
    VALUES (?, ?, ?)
  `),
  update: db.prepare(`
    UPDATE users
    SET email = ?, name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  };

  // 認証コード操作
  verificationQueries = {
  create: db.prepare(`
    INSERT INTO verification_codes (phone_number, code, expires_at)
    VALUES (?, ?, ?)
  `),
  findLatest: db.prepare(`
    SELECT * FROM verification_codes
    WHERE phone_number = ? AND verified = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `),
  markAsVerified: db.prepare(`
    UPDATE verification_codes
    SET verified = 1
    WHERE id = ?
  `),
  incrementAttempts: db.prepare(`
    UPDATE verification_codes
    SET attempts = attempts + 1
    WHERE id = ?
  `),
  deleteExpired: db.prepare(`
    DELETE FROM verification_codes
    WHERE expires_at <= datetime('now')
  `),
  };

  // 代行依頼操作
  submissionQueries = {
  findById: db.prepare('SELECT * FROM form_submissions WHERE id = ?'),
  findByEmail: db.prepare('SELECT * FROM form_submissions WHERE email = ? ORDER BY created_at DESC'),
  findByUserId: db.prepare('SELECT * FROM form_submissions WHERE user_id = ? ORDER BY created_at DESC'),
  create: db.prepare(`
    INSERT INTO form_submissions (
      user_id, email, name, plan, service_option, purchase_offer, return_method,
      inspection_option, items, total_quantity, total_declared_value, total_acquisition_value,
      total_fee, estimated_tax, estimated_grading_fee, total_estimated_fee, message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateStatus: db.prepare('UPDATE form_submissions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  };

  // セッション操作
  sessionQueries = {
  findByToken: db.prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"),
  create: db.prepare('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'),
  delete: db.prepare('DELETE FROM sessions WHERE token = ?'),
  deleteExpired: db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')"),
  };

  // お問い合わせ操作
  contactQueries = {
  findById: db.prepare('SELECT * FROM contacts WHERE id = ?'),
  findByUserId: db.prepare('SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC'),
  create: db.prepare(`
    INSERT INTO contacts (user_id, name, email, subject, message)
    VALUES (?, ?, ?, ?, ?)
  `),
    updateStatus: db.prepare('UPDATE contacts SET status = ? WHERE id = ?'),
  };

  // 進捗管理操作
  progressQueries = {
    findBySubmissionId: db.prepare('SELECT * FROM order_progress WHERE submission_id = ?'),
    create: db.prepare(`
      INSERT INTO order_progress (submission_id, current_step)
      VALUES (?, ?)
    `),
    updateStep: db.prepare(`
      UPDATE order_progress
      SET current_step = ?,
          step${1}_status = ?,
          step${1}_completed_at = ?,
          step${1}_details = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE submission_id = ?
    `),
    updateTracking: db.prepare(`
      UPDATE order_progress
      SET tracking_number = ?, updated_at = CURRENT_TIMESTAMP
      WHERE submission_id = ?
    `),
    updatePSAInfo: db.prepare(`
      UPDATE order_progress
      SET psa_submission_date = ?, psa_tracking_number = ?, estimated_completion_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE submission_id = ?
    `),
  };

  // 決済管理操作
  paymentQueries = {
    findById: db.prepare('SELECT * FROM payments WHERE id = ?'),
    findBySubmissionId: db.prepare('SELECT * FROM payments WHERE submission_id = ? ORDER BY created_at DESC'),
    create: db.prepare(`
      INSERT INTO payments (submission_id, payment_type, amount, status, payment_method, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    updateStatus: db.prepare(`
      UPDATE payments
      SET status = ?, payment_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `),
    updateReceipt: db.prepare(`
      UPDATE payments
      SET receipt_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `),
  };

  // 進捗履歴操作
  progressHistoryQueries = {
    findBySubmissionId: db.prepare('SELECT * FROM progress_history WHERE submission_id = ? ORDER BY created_at DESC'),
    create: db.prepare(`
      INSERT INTO progress_history (submission_id, step_number, old_status, new_status, changed_by, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
  };

  // 通知管理操作
  notificationQueries = {
    findById: db.prepare('SELECT * FROM notifications WHERE id = ?'),
    findBySubmissionId: db.prepare('SELECT * FROM notifications WHERE submission_id = ? ORDER BY created_at DESC'),
    findPending: db.prepare("SELECT * FROM notifications WHERE status = 'pending' ORDER BY created_at ASC LIMIT 10"),
    create: db.prepare(`
      INSERT INTO notifications (submission_id, user_id, notification_type, channel, recipient, subject, message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    updateStatus: db.prepare(`
      UPDATE notifications
      SET status = ?, sent_at = ?, error_message = ?
      WHERE id = ?
    `),
  };

  // 買取依頼管理操作
  kaitoriQueries = {
    findByToken: db.prepare('SELECT * FROM kaitori_requests WHERE token = ?'),
    findById: db.prepare('SELECT * FROM kaitori_requests WHERE id = ?'),
    findAll: db.prepare('SELECT * FROM kaitori_requests ORDER BY created_at DESC'),
    findByStatus: db.prepare('SELECT * FROM kaitori_requests WHERE status = ? ORDER BY created_at DESC'),
    create: db.prepare(`
      INSERT INTO kaitori_requests (
        token, card_name, card_condition, card_image_url,
        customer_name, customer_email, customer_phone, valid_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    updateAssessment: db.prepare(`
      UPDATE kaitori_requests
      SET assessment_price = ?, assessment_comment = ?,
          assessor_name = ?, assessment_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `),
    updateResponse: db.prepare(`
      UPDATE kaitori_requests
      SET status = ?, response_type = ?, response_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE token = ?
    `),
    updateBankInfo: db.prepare(`
      UPDATE kaitori_requests
      SET bank_name = ?, bank_branch = ?, account_number = ?, account_holder = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE token = ?
    `),
  };
}

// データベースとクエリを初期化
function init() {
  initDatabase();
  initQueries();
}

module.exports = {
  db,
  init,
  initDatabase,
  getDatabase: () => db,
  get userQueries() { return userQueries; },
  get verificationQueries() { return verificationQueries; },
  get submissionQueries() { return submissionQueries; },
  get sessionQueries() { return sessionQueries; },
  get contactQueries() { return contactQueries; },
  get progressQueries() { return progressQueries; },
  get paymentQueries() { return paymentQueries; },
  get progressHistoryQueries() { return progressHistoryQueries; },
  get notificationQueries() { return notificationQueries; },
  get kaitoriQueries() { return kaitoriQueries; },
};
