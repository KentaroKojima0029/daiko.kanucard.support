const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// データベースディレクトリの作成
const DB_DIR = './data';
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'psa_system.db');
const db = new Database(DB_PATH);

// WALモードを有効化（パフォーマンス向上）
db.pragma('journal_mode = WAL');

// データベース初期化
function initializeDatabase() {
    // ユーザー管理テーブル
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            shopify_id TEXT UNIQUE,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            phone TEXT,
            total_requests INTEGER DEFAULT 0,
            success_rate REAL DEFAULT 0.0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);

    // PSA代行依頼管理テーブル
    db.exec(`
        CREATE TABLE IF NOT EXISTS psa_requests (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            shopify_customer_id TEXT,
            status TEXT DEFAULT 'pending',
            progress_step INTEGER DEFAULT 1,
            country TEXT,
            plan_type TEXT,
            service_type TEXT DEFAULT 'psa-grading',
            total_declared_value INTEGER DEFAULT 0,
            total_estimated_grading_fee INTEGER DEFAULT 0,
            admin_notes TEXT,
            customer_notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // カード情報テーブル
    db.exec(`
        CREATE TABLE IF NOT EXISTS cards (
            id TEXT PRIMARY KEY,
            request_id TEXT NOT NULL,
            card_name TEXT NOT NULL,
            declared_value INTEGER,
            estimated_grading_fee INTEGER,
            actual_grade TEXT,
            grading_fee INTEGER,
            condition_notes TEXT,
            image_url TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (request_id) REFERENCES psa_requests(id) ON DELETE CASCADE
        )
    `);

    // 進捗管理テーブル
    db.exec(`
        CREATE TABLE IF NOT EXISTS progress_tracking (
            id TEXT PRIMARY KEY,
            request_id TEXT NOT NULL,
            step_number INTEGER NOT NULL,
            step_name TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            updated_by TEXT,
            notes TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (request_id) REFERENCES psa_requests(id) ON DELETE CASCADE
        )
    `);

    // ステップ詳細データテーブル（JSON形式で柔軟なデータを保存）
    db.exec(`
        CREATE TABLE IF NOT EXISTS step_details (
            id TEXT PRIMARY KEY,
            request_id TEXT NOT NULL,
            step_number INTEGER NOT NULL,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (request_id) REFERENCES psa_requests(id) ON DELETE CASCADE
        )
    `);

    // 管理者操作履歴テーブル
    db.exec(`
        CREATE TABLE IF NOT EXISTS admin_logs (
            id TEXT PRIMARY KEY,
            admin_user TEXT NOT NULL,
            action TEXT NOT NULL,
            target_request_id TEXT,
            target_user_id TEXT,
            details TEXT,
            ip_address TEXT,
            timestamp TEXT NOT NULL
        )
    `);

    // メッセージテーブル
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            request_id TEXT,
            from_user TEXT NOT NULL,
            to_user TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (request_id) REFERENCES psa_requests(id) ON DELETE CASCADE
        )
    `);

    // 買取承認テーブル
    db.exec(`
        CREATE TABLE IF NOT EXISTS approvals (
            id TEXT PRIMARY KEY,
            approval_key TEXT UNIQUE NOT NULL,
            customer_name TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            total_price INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);

    // 買取承認カード詳細テーブル
    db.exec(`
        CREATE TABLE IF NOT EXISTS approval_cards (
            id TEXT PRIMARY KEY,
            approval_id TEXT NOT NULL,
            card_name TEXT NOT NULL,
            price INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            customer_decision TEXT,
            customer_comment TEXT,
            FOREIGN KEY (approval_id) REFERENCES approvals(id) ON DELETE CASCADE
        )
    `);

    // サービス状況テーブル
    db.exec(`
        CREATE TABLE IF NOT EXISTS service_status (
            id TEXT PRIMARY KEY,
            service_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            description TEXT,
            last_updated TEXT NOT NULL
        )
    `);

    // 発送スケジュールテーブル
    db.exec(`
        CREATE TABLE IF NOT EXISTS shipping_schedule (
            id TEXT PRIMARY KEY,
            country TEXT UNIQUE NOT NULL,
            next_ship_date TEXT,
            notes TEXT,
            last_updated TEXT NOT NULL
        )
    `);

    // インデックスの作成（パフォーマンス最適化）
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_psa_requests_user_id ON psa_requests(user_id);
        CREATE INDEX IF NOT EXISTS idx_psa_requests_status ON psa_requests(status);
        CREATE INDEX IF NOT EXISTS idx_psa_requests_created_at ON psa_requests(created_at);
        CREATE INDEX IF NOT EXISTS idx_cards_request_id ON cards(request_id);
        CREATE INDEX IF NOT EXISTS idx_progress_tracking_request_id ON progress_tracking(request_id);
        CREATE INDEX IF NOT EXISTS idx_messages_request_id ON messages(request_id);
        CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
        CREATE INDEX IF NOT EXISTS idx_admin_logs_timestamp ON admin_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_approvals_approval_key ON approvals(approval_key);
    `);

    // 初期データの挿入（サービス状況）
    const checkServices = db.prepare('SELECT COUNT(*) as count FROM service_status').get();
    if (checkServices.count === 0) {
        const insertService = db.prepare(`
            INSERT INTO service_status (id, service_id, name, status, description, last_updated)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const now = new Date().toISOString();
        const { v4: uuidv4 } = require('uuid');

        insertService.run(uuidv4(), 'psa-grading', 'PSA鑑定', 'active', 'カード鑑定サービス', now);
        insertService.run(uuidv4(), 'purchase', '買取', 'active', 'カード買取サービス', now);
        insertService.run(uuidv4(), 'shipping', '発送代行', 'active', 'PSAへの発送代行', now);
    }

    // 初期データの挿入（発送スケジュール）
    const checkSchedule = db.prepare('SELECT COUNT(*) as count FROM shipping_schedule').get();
    if (checkSchedule.count === 0) {
        const insertSchedule = db.prepare(`
            INSERT INTO shipping_schedule (id, country, next_ship_date, notes, last_updated)
            VALUES (?, ?, ?, ?, ?)
        `);

        const now = new Date().toISOString();
        const { v4: uuidv4 } = require('uuid');

        insertSchedule.run(uuidv4(), 'usa', null, '', now);
        insertSchedule.run(uuidv4(), 'japan', null, '', now);
    }

    console.log('✓ Database initialized successfully');
}

// データベース初期化の実行
initializeDatabase();

// データベースクエリのヘルパー関数
const queries = {
    // ユーザー関連
    users: {
        create: db.prepare(`
            INSERT INTO users (id, shopify_id, email, name, phone, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `),
        findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
        findById: db.prepare('SELECT * FROM users WHERE id = ?'),
        findByShopifyId: db.prepare('SELECT * FROM users WHERE shopify_id = ?'),
        getAll: db.prepare('SELECT * FROM users ORDER BY created_at DESC'),
        update: db.prepare(`
            UPDATE users SET name = ?, phone = ?, updated_at = ? WHERE id = ?
        `),
        updateStats: db.prepare(`
            UPDATE users SET total_requests = ?, success_rate = ?, updated_at = ? WHERE id = ?
        `)
    },

    // PSA代行依頼関連
    requests: {
        create: db.prepare(`
            INSERT INTO psa_requests (
                id, user_id, shopify_customer_id, status, progress_step, country,
                plan_type, service_type, total_declared_value, total_estimated_grading_fee,
                admin_notes, customer_notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),
        findById: db.prepare('SELECT * FROM psa_requests WHERE id = ?'),
        findByUserId: db.prepare('SELECT * FROM psa_requests WHERE user_id = ? ORDER BY created_at DESC'),
        getAll: db.prepare('SELECT * FROM psa_requests ORDER BY created_at DESC'),
        updateStatus: db.prepare('UPDATE psa_requests SET status = ?, updated_at = ? WHERE id = ?'),
        updateStep: db.prepare('UPDATE psa_requests SET progress_step = ?, updated_at = ? WHERE id = ?'),
        update: db.prepare(`
            UPDATE psa_requests SET
                status = ?, progress_step = ?, admin_notes = ?, updated_at = ?
            WHERE id = ?
        `)
    },

    // カード関連
    cards: {
        create: db.prepare(`
            INSERT INTO cards (
                id, request_id, card_name, declared_value, estimated_grading_fee,
                actual_grade, grading_fee, condition_notes, image_url, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),
        findByRequestId: db.prepare('SELECT * FROM cards WHERE request_id = ?'),
        update: db.prepare(`
            UPDATE cards SET
                actual_grade = ?, grading_fee = ?, condition_notes = ?
            WHERE id = ?
        `)
    },

    // 進捗管理関連
    progress: {
        create: db.prepare(`
            INSERT INTO progress_tracking (
                id, request_id, step_number, step_name, status, updated_by, notes, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `),
        findByRequestId: db.prepare('SELECT * FROM progress_tracking WHERE request_id = ? ORDER BY step_number'),
        updateStatus: db.prepare('UPDATE progress_tracking SET status = ?, updated_by = ?, notes = ?, timestamp = ? WHERE id = ?')
    },

    // ステップ詳細関連
    stepDetails: {
        create: db.prepare(`
            INSERT INTO step_details (id, request_id, step_number, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `),
        findByRequestAndStep: db.prepare('SELECT * FROM step_details WHERE request_id = ? AND step_number = ?'),
        update: db.prepare('UPDATE step_details SET data = ?, updated_at = ? WHERE id = ?')
    },

    // メッセージ関連
    messages: {
        create: db.prepare(`
            INSERT INTO messages (id, request_id, from_user, to_user, message, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `),
        findByRequestId: db.prepare('SELECT * FROM messages WHERE request_id = ? ORDER BY created_at DESC'),
        getUnreadCount: db.prepare('SELECT COUNT(*) as count FROM messages WHERE to_user = ? AND is_read = 0'),
        markAsRead: db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?')
    },

    // 管理者ログ関連
    adminLogs: {
        create: db.prepare(`
            INSERT INTO admin_logs (id, admin_user, action, target_request_id, target_user_id, details, ip_address, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `),
        getRecent: db.prepare('SELECT * FROM admin_logs ORDER BY timestamp DESC LIMIT ?')
    },

    // 買取承認関連
    approvals: {
        create: db.prepare(`
            INSERT INTO approvals (id, approval_key, customer_name, customer_email, total_price, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `),
        findByKey: db.prepare('SELECT * FROM approvals WHERE approval_key = ?'),
        getAll: db.prepare('SELECT * FROM approvals ORDER BY created_at DESC'),
        updateStatus: db.prepare('UPDATE approvals SET status = ?, updated_at = ? WHERE id = ?')
    },

    // 買取承認カード関連
    approvalCards: {
        create: db.prepare(`
            INSERT INTO approval_cards (id, approval_id, card_name, price, status)
            VALUES (?, ?, ?, ?, ?)
        `),
        findByApprovalId: db.prepare('SELECT * FROM approval_cards WHERE approval_id = ?'),
        updateDecision: db.prepare(`
            UPDATE approval_cards SET customer_decision = ?, customer_comment = ? WHERE id = ?
        `)
    },

    // サービス状況関連
    serviceStatus: {
        getAll: db.prepare('SELECT * FROM service_status'),
        update: db.prepare('UPDATE service_status SET status = ?, last_updated = ? WHERE service_id = ?')
    },

    // 発送スケジュール関連
    shippingSchedule: {
        getByCountry: db.prepare('SELECT * FROM shipping_schedule WHERE country = ?'),
        getAll: db.prepare('SELECT * FROM shipping_schedule'),
        update: db.prepare('UPDATE shipping_schedule SET next_ship_date = ?, notes = ?, last_updated = ? WHERE country = ?')
    }
};

// トランザクションヘルパー
function transaction(fn) {
    return db.transaction(fn);
}

module.exports = {
    db,
    queries,
    transaction,
    initializeDatabase
};
