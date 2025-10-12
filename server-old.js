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
app.use(cors());
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

// Xserver FTP設定
const ftpConfig = {
    host: process.env.FTP_HOST || 'sv10210.xserver.jp',
    user: process.env.FTP_USER,
    password: process.env.FTP_PASSWORD,
    secure: false
};

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

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB制限
    }
});

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

// データファイルの読み込みと保存
const REQUESTS_FILE = path.join(DATA_DIR, 'approval_requests.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

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
        // Xserverにバックアップ
        backupToXserver(filePath);
    } catch (error) {
        console.error(`Error saving ${filePath}:`, error);
    }
}

// Xserverへのバックアップ
async function backupToXserver(localPath) {
    if (!ftpConfig.user || !ftpConfig.password) {
        console.log('FTP credentials not configured, skipping backup');
        return;
    }

    const client = new Client();
    try {
        await client.access(ftpConfig);
        const remotePath = `/kanucard-backup/${path.basename(localPath)}`;
        await client.ensureDir('/kanucard-backup');
        await client.uploadFrom(localPath, remotePath);
        console.log(`Backed up ${localPath} to Xserver`);
    } catch (error) {
        console.error('FTP backup error:', error);
    } finally {
        client.close();
    }
}

// データの初期化
let approvalRequests = loadData(REQUESTS_FILE, []);
let users = loadData(USERS_FILE, []);

// デフォルト管理者ユーザーの作成
async function initializeAdmin() {
    const adminEmail = process.env.ADMIN_EMAIL || 'collection@kanucard.com';
    const adminPassword = process.env.ADMIN_PASSWORD || '#collection30';

    const existingAdmin = users.find(u => u.email === adminEmail);
    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        users.push({
            id: uuidv4(),
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
            createdAt: new Date().toISOString()
        });
        saveData(USERS_FILE, users);
        console.log('Admin user initialized');
    }
}

initializeAdmin();

// 認証ミドルウェア（無効化 - 全てのリクエストを通す）
function authenticateToken(req, res, next) {
    // 認証をスキップし、ダミーのユーザー情報を設定
    req.user = {
        id: 'admin',
        email: 'collection@kanucard.com',
        role: 'admin'
    };
    next();
}

// 承認キー生成
function generateApprovalKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) key += '-';
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

// メール送信関数
async function sendApprovalEmail(requestData) {
    const {
        customerName,
        customerEmail,
        approvalKey,
        cards,
        totalPrice,
        expiresAt,
        notes
    } = requestData;

    const approvalUrl = `${process.env.BASE_URL || 'https://new-daiko-form.onrender.com'}/approval/${approvalKey}`;

    // カード情報のHTML生成
    const cardsHtml = cards.map((card, index) => `
        <tr>
            <td style="padding: 12px; border: 1px solid #ddd;">${index + 1}</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${card.name}</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${card.grade || '未設定'}</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">¥${(card.price || 0).toLocaleString()}</td>
        </tr>
    `).join('');

    const htmlContent = `
        <div style="max-width: 800px; margin: 0 auto; font-family: sans-serif;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">PSA代行 買取承認のお願い</h1>
            </div>

            <div style="background: white; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
                <p>お客様名: <strong>${customerName}</strong> 様</p>

                <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 10px 0;"><strong>承認キー:</strong> <code style="background: #fff; padding: 5px 10px; border: 1px solid #ddd;">${approvalKey}</code></p>
                    <p style="margin: 10px 0;"><strong>総額:</strong> ¥${totalPrice.toLocaleString()}</p>
                    <p style="margin: 10px 0;"><strong>有効期限:</strong> ${new Date(expiresAt).toLocaleString('ja-JP')}</p>
                </div>

                <h3>カード詳細</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">No.</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">カード名</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">グレード</th>
                            <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">買取価格</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cardsHtml}
                    </tbody>
                </table>

                ${notes ? `<div style="background: #fffacd; padding: 15px; border-radius: 8px; margin: 20px 0;"><strong>備考:</strong> ${notes}</div>` : ''}

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${approvalUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 50px; font-weight: bold;">承認ページを開く</a>
                </div>
            </div>
        </div>
    `;

    const mailOptions = {
        from: `PSA代行サービス <${process.env.SMTP_USER || 'collection@kanucard.com'}>`,
        to: customerEmail,
        subject: `【PSA代行】買取承認のお願い - ${customerName}様`,
        html: htmlContent
    };

    return await transporter.sendMail(mailOptions);
}

// ===== APIエンドポイント =====

// ログイン
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'ログインエラーが発生しました' });
    }
});

// 承認申請作成
app.post('/api/approval-requests', authenticateToken, async (req, res) => {
    try {
        const {
            customerName,
            customerEmail,
            cards,
            totalPrice,
            expirationHours = 72,
            notes
        } = req.body;

        if (!customerName || !customerEmail || !cards || cards.length === 0) {
            return res.status(400).json({ error: '必須項目が不足しています' });
        }

        const approvalKey = generateApprovalKey();
        const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

        const request = {
            id: uuidv4(),
            approvalKey,
            customerName,
            customerEmail,
            cards,
            totalPrice: totalPrice || cards.reduce((sum, card) => sum + (card.price || 0), 0),
            status: 'pending',
            createdBy: req.user.email,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            notes
        };

        approvalRequests.push(request);
        saveData(REQUESTS_FILE, approvalRequests);

        // メール送信
        try {
            await sendApprovalEmail(request);
            console.log('Approval email sent to:', customerEmail);
        } catch (emailError) {
            console.error('Email send error:', emailError);
        }

        res.json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error('Create approval request error:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// 承認申請一覧取得
app.get('/api/approval-requests', authenticateToken, (req, res) => {
    try {
        const sortedRequests = approvalRequests.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        res.json({
            success: true,
            data: sortedRequests
        });
    } catch (error) {
        console.error('Get approval requests error:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// 承認申請詳細取得（顧客用）
app.get('/api/approval/:key', (req, res) => {
    try {
        const { key } = req.params;
        const request = approvalRequests.find(r => r.approvalKey === key);

        if (!request) {
            return res.status(404).json({ error: '承認申請が見つかりません' });
        }

        if (new Date(request.expiresAt) < new Date()) {
            return res.status(400).json({ error: '承認期限が過ぎています' });
        }

        res.json({
            success: true,
            data: {
                customerName: request.customerName,
                cards: request.cards,
                totalPrice: request.totalPrice,
                expiresAt: request.expiresAt,
                notes: request.notes,
                status: request.status
            }
        });
    } catch (error) {
        console.error('Get approval detail error:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// 承認結果送信
app.post('/api/approval/:key/submit', async (req, res) => {
    try {
        const { key } = req.params;
        const { cards, overallStatus, customerComments } = req.body;

        const requestIndex = approvalRequests.findIndex(r => r.approvalKey === key);
        if (requestIndex === -1) {
            return res.status(404).json({ error: '承認申請が見つかりません' });
        }

        approvalRequests[requestIndex].status = overallStatus || 'responded';
        approvalRequests[requestIndex].respondedAt = new Date().toISOString();
        approvalRequests[requestIndex].responseCards = cards;
        approvalRequests[requestIndex].customerComments = customerComments;

        saveData(REQUESTS_FILE, approvalRequests);

        // 管理者に通知メール送信
        const adminEmail = process.env.ADMIN_EMAIL || 'collection@kanucard.com';
        const request = approvalRequests[requestIndex];

        const mailOptions = {
            from: `PSA代行サービス <${process.env.SMTP_USER || 'collection@kanucard.com'}>`,
            to: adminEmail,
            subject: `【承認結果】${request.customerName}様からの回答`,
            html: `
                <h2>承認結果を受信しました</h2>
                <p><strong>顧客名:</strong> ${request.customerName}</p>
                <p><strong>状態:</strong> ${overallStatus}</p>
                <p><strong>コメント:</strong> ${customerComments || 'なし'}</p>
                <p>詳細は管理画面でご確認ください。</p>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
        } catch (emailError) {
            console.error('Admin notification email error:', emailError);
        }

        res.json({
            success: true,
            message: '承認結果を送信しました'
        });
    } catch (error) {
        console.error('Submit approval response error:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// ファイルアップロード（Xserver連携）
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'ファイルがアップロードされていません' });
        }

        // Xserverにアップロード
        if (ftpConfig.user && ftpConfig.password) {
            const client = new Client();
            try {
                await client.access(ftpConfig);
                const remotePath = `/kanucard-files/${req.file.filename}`;
                await client.ensureDir('/kanucard-files');
                await client.uploadFrom(req.file.path, remotePath);
                console.log('File uploaded to Xserver:', remotePath);
            } catch (ftpError) {
                console.error('FTP upload error:', ftpError);
            } finally {
                client.close();
            }
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
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ error: 'ファイルアップロードエラー' });
    }
});

// 統計情報取得
app.get('/api/statistics', authenticateToken, (req, res) => {
    try {
        const stats = {
            totalRequests: approvalRequests.length,
            pendingRequests: approvalRequests.filter(r => r.status === 'pending').length,
            approvedRequests: approvalRequests.filter(r => r.status === 'approved').length,
            rejectedRequests: approvalRequests.filter(r => r.status === 'rejected').length,
            expiredRequests: approvalRequests.filter(r => new Date(r.expiresAt) < new Date()).length,
            totalValue: approvalRequests.reduce((sum, r) => sum + (r.totalPrice || 0), 0)
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// 静的ファイル配信
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/approval/:key', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'approval.html'));
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`PSA Approval System running on port ${PORT}`);
    console.log(`Admin Dashboard: http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;