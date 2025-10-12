require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Client } = require('basic-ftp');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['https://new-daiko-form.onrender.com', 'http://localhost:3001'],
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// セキュリティヘッダー
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// データ保存用ディレクトリ
const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// データファイルのパス
const FILES = {
    applications: path.join(DATA_DIR, 'applications.json'),         // 代行申込
    progress: path.join(DATA_DIR, 'progress.json'),                // 進捗状況
    messages: path.join(DATA_DIR, 'messages.json'),                // メッセージ
    approvals: path.join(DATA_DIR, 'approvals.json'),              // 買取承認
    serviceStatus: path.join(DATA_DIR, 'service_status.json'),     // サービス状況
    schedule: path.join(DATA_DIR, 'schedule.json'),                // 発送スケジュール
    users: path.join(DATA_DIR, 'users.json')                       // ユーザー
};

// Xserver FTP設定
const ftpConfig = {
    host: process.env.FTP_HOST || 'sv10210.xserver.jp',
    user: process.env.FTP_USER,
    password: process.env.FTP_PASSWORD,
    secure: false
};

// メール送信設定
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'sv10210.xserver.jp',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER || 'collection@kanucard.com',
        pass: process.env.SMTP_PASS
    }
});

// データ読み込み・保存関数
function loadData(filePath, defaultData = []) {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error(`Error loading ${filePath}:`, error);
    }
    return defaultData;
}

function saveData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        backupToXserver(filePath);
    } catch (error) {
        console.error(`Error saving ${filePath}:`, error);
    }
}

// Xserverへのバックアップ
async function backupToXserver(localPath) {
    if (!ftpConfig.user || !ftpConfig.password) {
        return;
    }

    const client = new Client();
    try {
        await client.access(ftpConfig);
        const remotePath = `/kanucard-backup/${path.basename(localPath)}`;
        await client.ensureDir('/kanucard-backup');
        await client.uploadFrom(localPath, remotePath);
    } catch (error) {
        console.error('FTP backup error:', error);
    } finally {
        client.close();
    }
}

// シードデータの初期化関数
function initializeSeedData() {
    const SEED_DIR = './data-seed';

    // アプリケーションデータが空の場合、シードデータをコピー
    if (!fs.existsSync(FILES.applications) || fs.readFileSync(FILES.applications, 'utf8').trim() === '[]' || fs.readFileSync(FILES.applications, 'utf8').trim() === '') {
        const seedFile = path.join(SEED_DIR, 'applications.json');
        if (fs.existsSync(seedFile)) {
            try {
                fs.copyFileSync(seedFile, FILES.applications);
                console.log('✓ Seed data copied from data-seed/applications.json');
            } catch (error) {
                console.error('Error copying seed data:', error);
            }
        }
    }
}

// シードデータの初期化を実行
initializeSeedData();

// データの初期化
let dataStore = {
    applications: loadData(FILES.applications, []),
    progress: loadData(FILES.progress, []),
    messages: loadData(FILES.messages, []),
    approvals: loadData(FILES.approvals, []),
    serviceStatus: loadData(FILES.serviceStatus, {
        services: [
            { id: 'psa-grading', name: 'PSA鑑定', status: 'active', description: 'カード鑑定サービス' },
            { id: 'purchase', name: '買取', status: 'active', description: 'カード買取サービス' },
            { id: 'shipping', name: '発送代行', status: 'active', description: 'PSAへの発送代行' }
        ],
        announcement: '',
        lastUpdated: new Date().toISOString()
    }),
    schedule: loadData(FILES.schedule, {
        usa: {
            nextShipDate: null,
            notes: ''
        },
        japan: {
            nextShipDate: null,
            notes: ''
        },
        lastUpdated: new Date().toISOString()
    })
};

// 認証ミドルウェア（管理者用サイトなので認証なし）
function authenticateToken(req, res, next) {
    req.user = {
        id: 'admin',
        email: 'collection@kanucard.com',
        role: 'admin'
    };
    next();
}

// ===== APIエンドポイント =====

// 1. 代行申込管理
app.get('/api/applications', authenticateToken, (req, res) => {
    res.json({
        success: true,
        data: dataStore.applications
    });
});

app.post('/api/applications', authenticateToken, (req, res) => {
    const application = {
        id: uuidv4(),
        ...req.body,
        createdAt: new Date().toISOString(),
        status: 'pending'
    };
    dataStore.applications.push(application);
    saveData(FILES.applications, dataStore.applications);
    res.json({ success: true, data: application });
});

app.put('/api/applications/:id', authenticateToken, (req, res) => {
    const index = dataStore.applications.findIndex(a => a.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: '申込が見つかりません' });
    }
    dataStore.applications[index] = { ...dataStore.applications[index], ...req.body };
    saveData(FILES.applications, dataStore.applications);
    res.json({ success: true, data: dataStore.applications[index] });
});

app.delete('/api/applications/:id', authenticateToken, (req, res) => {
    dataStore.applications = dataStore.applications.filter(a => a.id !== req.params.id);
    saveData(FILES.applications, dataStore.applications);
    res.json({ success: true });
});

// 2. 進捗状況管理（拡張版）
app.get('/api/progress', authenticateToken, (req, res) => {
    res.json({
        success: true,
        data: dataStore.progress
    });
});

app.get('/api/progress/:applicationId', authenticateToken, (req, res) => {
    const progress = dataStore.progress.find(p => p.applicationId === req.params.applicationId);
    if (!progress) {
        // 新規作成
        const newProgress = {
            id: uuidv4(),
            applicationId: req.params.applicationId,
            steps: {
                step1: { status: 'completed', date: new Date().toISOString(), notes: '申込受付完了' },
                step2: { status: 'pending', date: null, notes: '' },
                step3: { status: 'pending', date: null, notes: '' },
                step4: { status: 'pending', date: null, notes: '', cards: [] },
                step5: { status: 'pending', date: null, notes: '', fees: {} },
                step6: { status: 'pending', date: null, notes: '', trackingNumbers: {} }
            },
            createdAt: new Date().toISOString()
        };
        dataStore.progress.push(newProgress);
        saveData(FILES.progress, dataStore.progress);
        return res.json({ success: true, data: newProgress });
    }
    res.json({ success: true, data: progress });
});

app.post('/api/progress', authenticateToken, (req, res) => {
    const progress = {
        id: uuidv4(),
        applicationId: req.body.applicationId,
        planDate: req.body.planDate,
        country: req.body.country,
        planType: req.body.planType,
        customers: req.body.customers || [],
        steps: {
            step1: { status: 'completed', date: new Date().toISOString(), notes: '申込受付完了' },
            step2: { status: 'pending', date: null, notes: '' },
            step3: { status: 'pending', date: null, notes: '' },
            step4: { status: 'pending', date: null, notes: '', cards: [] },
            step5: { status: 'pending', date: null, notes: '', fees: {} },
            step6: { status: 'pending', date: null, notes: '', trackingNumbers: {} }
        },
        createdAt: new Date().toISOString(),
        updatedBy: req.user.email
    };

    // 既存のエントリを確認
    const existingIndex = dataStore.progress.findIndex(p => p.applicationId === req.body.applicationId);
    if (existingIndex !== -1) {
        dataStore.progress[existingIndex] = progress;
    } else {
        dataStore.progress.push(progress);
    }

    saveData(FILES.progress, dataStore.progress);
    res.json({ success: true, data: progress });
});

app.put('/api/progress/:applicationId/step/:stepId', authenticateToken, (req, res) => {
    const progressIndex = dataStore.progress.findIndex(p => p.applicationId === req.params.applicationId);
    if (progressIndex === -1) {
        return res.status(404).json({ error: '進捗情報が見つかりません' });
    }

    const stepId = req.params.stepId;
    if (!dataStore.progress[progressIndex].steps[stepId]) {
        return res.status(400).json({ error: '無効なステップIDです' });
    }

    // ステップ情報を更新
    dataStore.progress[progressIndex].steps[stepId] = {
        ...dataStore.progress[progressIndex].steps[stepId],
        ...req.body,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.email
    };

    saveData(FILES.progress, dataStore.progress);
    res.json({ success: true, data: dataStore.progress[progressIndex] });
});

// 3. メッセージ管理
app.get('/api/messages', authenticateToken, (req, res) => {
    res.json({
        success: true,
        data: dataStore.messages
    });
});

app.post('/api/messages', authenticateToken, (req, res) => {
    const message = {
        id: uuidv4(),
        applicationId: req.body.applicationId,
        from: req.body.from || 'admin',
        to: req.body.to,
        message: req.body.message,
        createdAt: new Date().toISOString(),
        read: false
    };
    dataStore.messages.push(message);
    saveData(FILES.messages, dataStore.messages);

    // メール送信（必要に応じて）
    if (req.body.sendEmail) {
        sendMessageEmail(message, req.body.toEmail);
    }

    res.json({ success: true, data: message });
});

app.put('/api/messages/:id/read', authenticateToken, (req, res) => {
    const index = dataStore.messages.findIndex(m => m.id === req.params.id);
    if (index !== -1) {
        dataStore.messages[index].read = true;
        saveData(FILES.messages, dataStore.messages);
    }
    res.json({ success: true });
});

// 4. 買取承認管理（既存機能を拡張）
app.get('/api/approvals', authenticateToken, (req, res) => {
    res.json({
        success: true,
        data: dataStore.approvals
    });
});

app.post('/api/approvals', authenticateToken, async (req, res) => {
    const approval = {
        id: uuidv4(),
        approvalKey: generateApprovalKey(),
        ...req.body,
        createdAt: new Date().toISOString(),
        status: 'pending'
    };
    dataStore.approvals.push(approval);
    saveData(FILES.approvals, dataStore.approvals);

    // 承認メール送信
    if (req.body.sendEmail) {
        await sendApprovalEmail(approval);
    }

    res.json({ success: true, data: approval });
});

// 5. サービス状況管理
app.get('/api/service-status', (req, res) => {
    res.json({
        success: true,
        data: dataStore.serviceStatus
    });
});

app.put('/api/service-status', authenticateToken, (req, res) => {
    dataStore.serviceStatus = {
        ...dataStore.serviceStatus,
        ...req.body,
        lastUpdated: new Date().toISOString()
    };
    saveData(FILES.serviceStatus, dataStore.serviceStatus);
    res.json({ success: true, data: dataStore.serviceStatus });
});

// 6. 発送スケジュール管理
app.get('/api/schedule', (req, res) => {
    res.json({
        success: true,
        data: dataStore.schedule
    });
});

app.put('/api/schedule', authenticateToken, (req, res) => {
    dataStore.schedule = {
        usa: req.body.usa || dataStore.schedule.usa,
        japan: req.body.japan || dataStore.schedule.japan,
        lastUpdated: new Date().toISOString()
    };
    saveData(FILES.schedule, dataStore.schedule);
    res.json({ success: true, data: dataStore.schedule });
});

// 7. 統計情報
app.get('/api/statistics', authenticateToken, (req, res) => {
    const stats = {
        totalApplications: dataStore.applications.length,
        pendingApplications: dataStore.applications.filter(a => a.status === 'pending').length,
        inProgressApplications: dataStore.applications.filter(a => a.status === 'in_progress').length,
        completedApplications: dataStore.applications.filter(a => a.status === 'completed').length,
        totalApprovals: dataStore.approvals.length,
        pendingApprovals: dataStore.approvals.filter(a => a.status === 'pending').length,
        unreadMessages: dataStore.messages.filter(m => !m.read && m.to === 'admin').length,
        serviceStatus: dataStore.serviceStatus.services.map(s => ({
            name: s.name,
            status: s.status
        })),
        nextShipDateUSA: dataStore.schedule.usa?.nextShipDate,
        nextShipDateJapan: dataStore.schedule.japan?.nextShipDate
    };
    res.json({ success: true, data: stats });
});

// 8. 利用者サイト用API（CORS対応）
app.get('/api/public/service-status', (req, res) => {
    res.json({
        success: true,
        data: {
            services: dataStore.serviceStatus.services,
            announcement: dataStore.serviceStatus.announcement
        }
    });
});

app.get('/api/public/schedule', (req, res) => {
    res.json({
        success: true,
        data: {
            usa: dataStore.schedule.usa,
            japan: dataStore.schedule.japan,
            lastUpdated: dataStore.schedule.lastUpdated
        }
    });
});

app.get('/api/public/application/:id/progress', (req, res) => {
    const application = dataStore.applications.find(a => a.id === req.params.id);
    if (!application) {
        return res.status(404).json({ error: '申込が見つかりません' });
    }

    const progress = dataStore.progress.find(p => p.applicationId === req.params.id);
    if (!progress) {
        return res.json({
            success: true,
            data: {
                application: {
                    id: application.id,
                    status: application.status,
                    createdAt: application.createdAt
                },
                steps: {
                    step1: { status: 'completed', date: application.createdAt, notes: '申込受付完了' },
                    step2: { status: 'pending', date: null, notes: '' },
                    step3: { status: 'pending', date: null, notes: '' },
                    step4: { status: 'pending', date: null, notes: '' },
                    step5: { status: 'pending', date: null, notes: '' },
                    step6: { status: 'pending', date: null, notes: '' }
                }
            }
        });
    }

    res.json({
        success: true,
        data: {
            application: {
                id: application.id,
                status: application.status,
                createdAt: application.createdAt,
                customerName: application.customerName
            },
            planInfo: {
                date: progress.planDate,
                country: progress.country,
                planType: progress.planType
            },
            steps: progress.steps
        }
    });
});

// メール送信関数
async function sendMessageEmail(message, toEmail) {
    const mailOptions = {
        from: `PSA代行サービス <${process.env.SMTP_USER || 'collection@kanucard.com'}>`,
        to: toEmail,
        subject: 'PSA代行サービスからのメッセージ',
        html: `
            <div style="max-width: 600px; margin: 0 auto; font-family: sans-serif;">
                <h2>新しいメッセージがあります</h2>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
                    <p>${message.message}</p>
                </div>
                <p style="margin-top: 20px;">
                    <a href="https://new-daiko-form.onrender.com/mypage" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        マイページで確認
                    </a>
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Email send error:', error);
    }
}

async function sendApprovalEmail(approval) {
    const approvalUrl = `https://new-daiko-form.onrender.com/approval/${approval.approvalKey}`;

    const mailOptions = {
        from: `PSA代行サービス <${process.env.SMTP_USER || 'collection@kanucard.com'}>`,
        to: approval.customerEmail,
        subject: `【PSA代行】買取承認のお願い - ${approval.customerName}様`,
        html: `
            <div style="max-width: 800px; margin: 0 auto; font-family: sans-serif;">
                <h1 style="color: #667eea;">PSA代行 買取承認のお願い</h1>
                <p>${approval.customerName}様</p>
                <p>以下のカードの買取価格についてご確認をお願いします。</p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>承認キー:</strong> ${approval.approvalKey}</p>
                    <p><strong>総額:</strong> ¥${(approval.totalPrice || 0).toLocaleString()}</p>
                </div>
                <p>
                    <a href="${approvalUrl}" style="display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">
                        承認ページを開く
                    </a>
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Approval email send error:', error);
    }
}

function generateApprovalKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) key += '-';
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

// ファイルアップロード設定
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(DATA_DIR, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// ファイルアップロードエンドポイント
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'ファイルがアップロードされていません' });
    }
    res.json({
        success: true,
        file: {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            path: req.file.path
        }
    });
});

// 静的ファイル配信
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`PSA Admin System running on port ${PORT}`);
    console.log(`Admin Dashboard: http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;