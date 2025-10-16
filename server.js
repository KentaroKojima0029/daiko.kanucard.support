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

// データベースサービスのインポート
const dbService = require('./services/database-service');
const { initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['https://kanucard-daiko-support.onrender.com', 'https://daiko.kanucard.com', 'http://localhost:3001', 'http://localhost:3000'],
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

// 認証ミドルウェア（JWT認証）
function authenticateToken(req, res, next) {
    // 開発環境では認証をスキップ
    if (process.env.NODE_ENV === 'development') {
        req.user = {
            id: 'admin',
            email: 'collection@kanucard.com',
            role: 'admin'
        };
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        // トークンがない場合はデフォルト管理者として処理
        req.user = {
            id: 'admin',
            email: 'collection@kanucard.com',
            role: 'admin'
        };
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// 管理者ログミドルウェア
function logAdminAction(action) {
    return (req, res, next) => {
        // レスポンス後にログ記録
        res.on('finish', () => {
            if (res.statusCode < 400) {
                dbService.logAdminAction({
                    adminUser: req.user.email,
                    action: action,
                    targetRequestId: req.params.id || req.params.applicationId || null,
                    targetUserId: req.params.userId || null,
                    details: JSON.stringify({
                        method: req.method,
                        path: req.path,
                        body: req.body
                    }),
                    ipAddress: req.ip
                });
            }
        });
        next();
    };
}

// ===== APIエンドポイント =====

// 1. ユーザー管理
app.get('/api/users', authenticateToken, (req, res) => {
    try {
        const users = dbService.getAllUsers();
        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'ユーザー取得エラー' });
    }
});

app.get('/api/users/:userId', authenticateToken, (req, res) => {
    try {
        const user = dbService.getUserById(req.params.userId);
        if (!user) {
            return res.status(404).json({ error: 'ユーザーが見つかりません' });
        }
        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'ユーザー取得エラー' });
    }
});

app.post('/api/users', authenticateToken, (req, res) => {
    try {
        const user = dbService.findOrCreateUser(req.body);
        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'ユーザー作成エラー' });
    }
});

// 2. PSA代行申込管理（統合版）
app.get('/api/applications', authenticateToken, (req, res) => {
    try {
        const applications = dbService.getAllPSARequests();
        res.json({ success: true, data: applications });
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ error: '申込取得エラー' });
    }
});

app.get('/api/applications/:id', authenticateToken, (req, res) => {
    try {
        const application = dbService.getPSARequestById(req.params.id);
        if (!application) {
            return res.status(404).json({ error: '申込が見つかりません' });
        }
        res.json({ success: true, data: application });
    } catch (error) {
        console.error('Error fetching application:', error);
        res.status(500).json({ error: '申込取得エラー' });
    }
});

app.post('/api/applications', authenticateToken, logAdminAction('create_application'), (req, res) => {
    try {
        // ユーザーの作成または取得
        const user = dbService.findOrCreateUser({
            email: req.body.customerEmail,
            name: req.body.customerName,
            phone: req.body.phoneNumber
        });

        // PSAリクエストの作成
        const requestData = {
            userId: user.id,
            shopifyCustomerId: req.body.shopifyCustomerId || null,
            status: req.body.status || 'pending',
            country: req.body.country || null,
            planType: req.body.planType || null,
            serviceType: req.body.serviceType || 'psa-grading',
            totalDeclaredValue: req.body.totalDeclaredValue || 0,
            totalEstimatedGradingFee: req.body.totalEstimatedGradingFee || 0,
            customerNotes: req.body.notes || null,
            cards: req.body.cards || []
        };

        const application = dbService.createPSARequest(requestData);
        res.json({ success: true, data: application });
    } catch (error) {
        console.error('Error creating application:', error);
        res.status(500).json({ error: '申込作成エラー' });
    }
});

app.put('/api/applications/:id', authenticateToken, logAdminAction('update_application'), (req, res) => {
    try {
        const application = dbService.updatePSARequestStatus(
            req.params.id,
            req.body.status,
            req.body.adminNotes
        );

        if (!application) {
            return res.status(404).json({ error: '申込が見つかりません' });
        }

        res.json({ success: true, data: application });
    } catch (error) {
        console.error('Error updating application:', error);
        res.status(500).json({ error: '申込更新エラー' });
    }
});

app.delete('/api/applications/:id', authenticateToken, logAdminAction('delete_application'), (req, res) => {
    try {
        // Note: データベースにはDELETE機能を追加する必要があります
        // 現時点では status を 'deleted' に設定
        const application = dbService.updatePSARequestStatus(req.params.id, 'deleted');
        res.json({ success: true, data: application });
    } catch (error) {
        console.error('Error deleting application:', error);
        res.status(500).json({ error: '申込削除エラー' });
    }
});

// 3. 進捗状況管理（拡張版）
app.get('/api/progress', authenticateToken, (req, res) => {
    try {
        const requests = dbService.getAllPSARequests();
        const progressData = requests.map(req => ({
            id: req.id,
            applicationId: req.id,
            steps: req.progress,
            planDate: req.created_at,
            country: req.country,
            planType: req.plan_type
        }));
        res.json({ success: true, data: progressData });
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({ error: '進捗取得エラー' });
    }
});

app.get('/api/progress/:applicationId', authenticateToken, (req, res) => {
    try {
        const application = dbService.getPSARequestById(req.params.applicationId);
        if (!application) {
            return res.status(404).json({ error: '申込が見つかりません' });
        }

        // 進捗データを整形
        const progressData = {
            id: application.id,
            applicationId: application.id,
            steps: {},
            planDate: application.created_at,
            country: application.country,
            planType: application.plan_type,
            createdAt: application.created_at
        };

        // ステップデータを変換
        if (application.progress && Array.isArray(application.progress)) {
            application.progress.forEach(step => {
                progressData.steps[`step${step.step_number}`] = {
                    status: step.status,
                    date: step.timestamp,
                    notes: step.notes
                };
            });
        }

        res.json({ success: true, data: progressData });
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({ error: '進捗取得エラー' });
    }
});

app.put('/api/progress/:applicationId/step/:stepId', authenticateToken, logAdminAction('update_progress_step'), (req, res) => {
    try {
        const stepNumber = parseInt(req.params.stepId.replace('step', ''));
        const application = dbService.updatePSARequestStep(
            req.params.applicationId,
            stepNumber,
            req.body,
            req.user.email
        );

        if (!application) {
            return res.status(404).json({ error: '申込が見つかりません' });
        }

        res.json({ success: true, data: application });
    } catch (error) {
        console.error('Error updating progress step:', error);
        res.status(500).json({ error: '進捗更新エラー' });
    }
});

// 4. メッセージ管理
app.get('/api/messages', authenticateToken, (req, res) => {
    try {
        // 全てのリクエストのメッセージを取得
        const applications = dbService.getAllPSARequests();
        const allMessages = [];

        applications.forEach(app => {
            const messages = dbService.getMessagesForRequest(app.id);
            allMessages.push(...messages);
        });

        res.json({ success: true, data: allMessages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'メッセージ取得エラー' });
    }
});

app.post('/api/messages', authenticateToken, logAdminAction('send_message'), async (req, res) => {
    try {
        const messageId = dbService.createMessage({
            requestId: req.body.requestId || null,
            from: req.body.from || req.user.email,
            to: req.body.to,
            message: req.body.message
        });

        // メール送信（必要に応じて）
        if (req.body.sendEmail && req.body.toEmail) {
            await sendMessageEmail({
                message: req.body.message,
                from: req.user.email
            }, req.body.toEmail);
        }

        res.json({ success: true, messageId: messageId });
    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ error: 'メッセージ作成エラー' });
    }
});

app.put('/api/messages/:id/read', authenticateToken, (req, res) => {
    try {
        dbService.markMessageAsRead(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({ error: 'メッセージ更新エラー' });
    }
});

// 5. 買取承認管理
app.get('/api/approvals', authenticateToken, (req, res) => {
    try {
        const approvals = dbService.getAllApprovals();
        res.json({ success: true, data: approvals });
    } catch (error) {
        console.error('Error fetching approvals:', error);
        res.status(500).json({ error: '承認取得エラー' });
    }
});

app.post('/api/approvals', authenticateToken, logAdminAction('create_approval'), async (req, res) => {
    try {
        const approvalData = {
            approvalKey: generateApprovalKey(),
            customerName: req.body.customerName,
            customerEmail: req.body.customerEmail,
            totalPrice: req.body.totalPrice || 0,
            cards: req.body.cards || []
        };

        const approval = dbService.createApproval(approvalData);

        // 承認メール送信
        if (req.body.sendEmail) {
            await sendApprovalEmail(approval);
        }

        res.json({ success: true, data: approval });
    } catch (error) {
        console.error('Error creating approval:', error);
        res.status(500).json({ error: '承認作成エラー' });
    }
});

// 5-1. 顧客承認ページ用エンドポイント（認証不要）
app.get('/api/approval/:key', (req, res) => {
    try {
        const approvalKey = req.params.key;
        console.log('承認データ取得要求:', approvalKey);

        const approval = dbService.getApprovalByKey(approvalKey);

        if (!approval) {
            return res.status(404).json({
                success: false,
                message: '承認キーが無効です。正しい承認キーを入力してください。'
            });
        }

        // 有効期限チェック
        if (approval.deadline && new Date(approval.deadline) < new Date()) {
            return res.status(400).json({
                success: false,
                message: '承認期限が過ぎています。'
            });
        }

        // 既に回答済みかチェック
        if (approval.status === 'submitted' || approval.status === 'responded') {
            return res.status(400).json({
                success: false,
                message: 'この承認は既に回答済みです。'
            });
        }

        // 顧客承認画面用のデータ形式に変換
        const cards = approval.cards || [];
        const responseData = {
            customer: {
                name: approval.customer_name || '未設定',
                email: approval.customer_email || '未設定',
                phone: '未設定'
            },
            cards: cards.map((card, index) => ({
                id: index,
                name: card.name || 'カード',
                price: card.price || 0,
                grade: card.grade || '未設定',
                condition: '未設定',
                notes: card.notes || null,
                status: 'pending'
            })),
            deadline: approval.deadline || approval.expires_at
        };

        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        console.error('承認データ取得エラー:', error);
        res.status(500).json({
            success: false,
            message: 'サーバーエラーが発生しました'
        });
    }
});

app.post('/api/approval/:key/submit', (req, res) => {
    try {
        const approvalKey = req.params.key;
        const submissionData = req.body;

        console.log('承認結果受信:', approvalKey, submissionData);

        const approval = dbService.getApprovalByKey(approvalKey);

        if (!approval) {
            return res.status(404).json({
                success: false,
                message: '承認キーが無効です'
            });
        }

        // カード承認結果を更新
        const updatedCards = submissionData.cards || [];
        const updateResult = dbService.updateApprovalResponse(approvalKey, {
            status: 'submitted',
            submittedAt: submissionData.submittedAt,
            cards: updatedCards
        });

        if (!updateResult) {
            return res.status(500).json({
                success: false,
                message: '承認結果の保存に失敗しました'
            });
        }

        res.json({
            success: true,
            message: '承認結果を正常に保存しました'
        });

    } catch (error) {
        console.error('承認結果送信エラー:', error);
        res.status(500).json({
            success: false,
            message: 'サーバーエラーが発生しました'
        });
    }
});

// 6. サービス状況管理
app.get('/api/service-status', (req, res) => {
    try {
        const services = dbService.getAllServiceStatus();
        res.json({
            success: true,
            data: {
                services: services,
                announcement: '',
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching service status:', error);
        res.status(500).json({ error: 'サービス状況取得エラー' });
    }
});

app.put('/api/service-status', authenticateToken, logAdminAction('update_service_status'), (req, res) => {
    try {
        if (req.body.services && Array.isArray(req.body.services)) {
            req.body.services.forEach(service => {
                dbService.updateServiceStatus(service.id, service.status);
            });
        }

        const services = dbService.getAllServiceStatus();
        res.json({
            success: true,
            data: {
                services: services,
                announcement: req.body.announcement || '',
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error updating service status:', error);
        res.status(500).json({ error: 'サービス状況更新エラー' });
    }
});

// 7. 発送スケジュール管理
app.get('/api/schedule', (req, res) => {
    try {
        const schedules = dbService.getShippingSchedule();
        const scheduleData = {
            usa: schedules.find(s => s.country === 'usa'),
            japan: schedules.find(s => s.country === 'japan'),
            lastUpdated: new Date().toISOString()
        };
        res.json({ success: true, data: scheduleData });
    } catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ error: 'スケジュール取得エラー' });
    }
});

app.put('/api/schedule', authenticateToken, logAdminAction('update_schedule'), (req, res) => {
    try {
        if (req.body.usa) {
            dbService.updateShippingSchedule('usa', req.body.usa);
        }
        if (req.body.japan) {
            dbService.updateShippingSchedule('japan', req.body.japan);
        }

        const schedules = dbService.getShippingSchedule();
        const scheduleData = {
            usa: schedules.find(s => s.country === 'usa'),
            japan: schedules.find(s => s.country === 'japan'),
            lastUpdated: new Date().toISOString()
        };

        res.json({ success: true, data: scheduleData });
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({ error: 'スケジュール更新エラー' });
    }
});

// 8. 統計情報
app.get('/api/statistics', authenticateToken, (req, res) => {
    try {
        const stats = dbService.getStatistics();
        const schedules = dbService.getShippingSchedule();
        const services = dbService.getAllServiceStatus();

        const fullStats = {
            ...stats,
            serviceStatus: services.map(s => ({
                name: s.name,
                status: s.status
            })),
            nextShipDateUSA: schedules.find(s => s.country === 'usa')?.next_ship_date,
            nextShipDateJapan: schedules.find(s => s.country === 'japan')?.next_ship_date,
            unreadMessages: dbService.getUnreadMessageCount('admin')
        };

        res.json({ success: true, data: fullStats });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: '統計情報取得エラー' });
    }
});

// 9. 利用者サイト用公開API（CORS対応）
app.get('/api/public/service-status', (req, res) => {
    try {
        const services = dbService.getAllServiceStatus();
        res.json({
            success: true,
            data: {
                services: services.map(s => ({
                    id: s.service_id,
                    name: s.name,
                    status: s.status
                })),
                announcement: ''
            }
        });
    } catch (error) {
        console.error('Error fetching public service status:', error);
        res.status(500).json({ error: 'サービス状況取得エラー' });
    }
});

app.get('/api/public/schedule', (req, res) => {
    try {
        const schedules = dbService.getShippingSchedule();
        const scheduleData = {
            usa: {
                nextShipDate: schedules.find(s => s.country === 'usa')?.next_ship_date,
                notes: schedules.find(s => s.country === 'usa')?.notes || ''
            },
            japan: {
                nextShipDate: schedules.find(s => s.country === 'japan')?.next_ship_date,
                notes: schedules.find(s => s.country === 'japan')?.notes || ''
            },
            lastUpdated: new Date().toISOString()
        };
        res.json({ success: true, data: scheduleData });
    } catch (error) {
        console.error('Error fetching public schedule:', error);
        res.status(500).json({ error: 'スケジュール取得エラー' });
    }
});

app.get('/api/public/application/:id/progress', (req, res) => {
    try {
        const application = dbService.getPSARequestById(req.params.id);
        if (!application) {
            return res.status(404).json({ error: '申込が見つかりません' });
        }

        const user = dbService.getUserById(application.user_id);

        // 進捗ステップを整形
        const steps = {};
        if (application.progress && Array.isArray(application.progress)) {
            application.progress.forEach(step => {
                steps[`step${step.step_number}`] = {
                    status: step.status,
                    date: step.timestamp,
                    notes: step.notes
                };
            });
        }

        res.json({
            success: true,
            data: {
                application: {
                    id: application.id,
                    status: application.status,
                    createdAt: application.created_at,
                    customerName: user?.name || '顧客'
                },
                planInfo: {
                    country: application.country,
                    planType: application.plan_type
                },
                steps: steps
            }
        });
    } catch (error) {
        console.error('Error fetching public progress:', error);
        res.status(500).json({ error: '進捗取得エラー' });
    }
});

// 9-1. ユーザーフォーム送信用公開API（認証不要・CORS対応）
app.post('/api/public/form-submit', async (req, res) => {
    try {
        const {
            contactName,
            contactEmail,
            contactBody,
            plan,
            serviceOption,
            purchaseOffer,
            returnMethod,
            inspectionOption,
            items,
            totalQuantity,
            totalDeclaredValue,
            totalAcquisitionValue,
            totalFee,
            estimatedTax,
            estimatedGradingFee,
            totalEstimatedFee
        } = req.body;

        // バリデーション
        if (!contactName || !contactEmail || !items || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: '必須項目が不足しています'
            });
        }

        console.log('Public form submission received:', { contactName, contactEmail, itemCount: items.length });

        // プラン情報からcountryとplanTypeを抽出
        let country = null;
        let planType = null;

        if (plan && typeof plan === 'string') {
            if (plan.includes('日本') || plan.includes('ノーマル 日本') || plan.includes('70％保証 日本')) {
                country = 'japan';
            } else if (plan.includes('アメリカ') || plan.includes('USA')) {
                country = 'usa';
            }

            if (plan.includes('ノーマル') && !plan.includes('保証')) {
                planType = 'normal';
            } else if (plan.includes('70％保証') || plan.includes('保証')) {
                planType = 'guarantee';
            }
        }

        // ユーザーの作成または取得
        const user = dbService.findOrCreateUser({
            email: contactEmail,
            name: contactName,
            phone: null
        });

        // カード情報を変換
        const cards = items.map(item => ({
            cardName: item.itemName,
            quantity: item.quantity || 1,
            declaredValue: item.declaredValue || 0,
            acquisitionValue: item.acquisitionValue || 0
        }));

        // PSAリクエストの作成
        const requestData = {
            userId: user.id,
            shopifyCustomerId: null,
            status: 'pending',
            country: country,
            planType: planType,
            serviceType: 'psa-grading',
            totalDeclaredValue: totalDeclaredValue || 0,
            totalEstimatedGradingFee: typeof estimatedGradingFee === 'string' ?
                parseInt(estimatedGradingFee.replace(/[^0-9]/g, '')) :
                (estimatedGradingFee || 0),
            customerNotes: contactBody || null,
            cards: cards
        };

        const application = dbService.createPSARequest(requestData);

        console.log('PSA request created successfully:', application.id);

        res.json({
            success: true,
            message: 'お申し込みを受け付けました',
            data: {
                applicationId: application.id,
                userId: user.id
            }
        });

    } catch (error) {
        console.error('Error processing public form submission:', error);
        res.status(500).json({
            success: false,
            error: 'サーバーエラーが発生しました。もう一度お試しください。'
        });
    }
});

// 10. 管理者ログ取得
app.get('/api/admin/logs', authenticateToken, (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = dbService.getRecentAdminLogs(limit);
        res.json({ success: true, data: logs });
    } catch (error) {
        console.error('Error fetching admin logs:', error);
        res.status(500).json({ error: 'ログ取得エラー' });
    }
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
                    <a href="https://kanucard-daiko-support.onrender.com/mypage" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
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
    const approvalUrl = `https://kanucard-daiko-support.onrender.com/approval/${approval.approval_key}`;

    const mailOptions = {
        from: `PSA代行サービス <${process.env.SMTP_USER || 'collection@kanucard.com'}>`,
        to: approval.customer_email,
        subject: `【PSA代行】買取承認のお願い - ${approval.customer_name}様`,
        html: `
            <div style="max-width: 800px; margin: 0 auto; font-family: sans-serif;">
                <h1 style="color: #667eea;">PSA代行 買取承認のお願い</h1>
                <p>${approval.customer_name}様</p>
                <p>以下のカードの買取価格についてご確認をお願いします。</p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>承認キー:</strong> ${approval.approval_key}</p>
                    <p><strong>総額:</strong> ¥${(approval.total_price || 0).toLocaleString()}</p>
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

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString()
    });
});

// データベース初期化
console.log('Initializing database...');
initializeDatabase();

// サーバー起動
app.listen(PORT, () => {
    console.log(`PSA Admin System (Integrated) running on port ${PORT}`);
    console.log(`Admin Dashboard: http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Database: SQLite`);
});

module.exports = app;
