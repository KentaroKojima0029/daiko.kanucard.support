const { queries, transaction } = require('../database');
const { v4: uuidv4 } = require('uuid');

class DatabaseService {
    // ユーザー管理
    createUser(userData) {
        const id = uuidv4();
        const now = new Date().toISOString();

        queries.users.create.run(
            id,
            userData.shopifyId || null,
            userData.email,
            userData.name || null,
            userData.phone || null,
            now,
            now
        );

        return queries.users.findById.get(id);
    }

    findOrCreateUser(userData) {
        let user = queries.users.findByEmail.get(userData.email);

        if (!user && userData.shopifyId) {
            user = queries.users.findByShopifyId.get(userData.shopifyId);
        }

        if (!user) {
            user = this.createUser(userData);
        }

        return user;
    }

    getUserById(userId) {
        return queries.users.findById.get(userId);
    }

    getAllUsers() {
        return queries.users.getAll.all();
    }

    updateUser(userId, updates) {
        const now = new Date().toISOString();
        queries.users.update.run(
            updates.name,
            updates.phone,
            now,
            userId
        );
        return queries.users.findById.get(userId);
    }

    // PSA代行依頼管理
    createPSARequest(requestData) {
        const createRequest = transaction((data) => {
            const requestId = uuidv4();
            const now = new Date().toISOString();

            // リクエストの作成
            queries.requests.create.run(
                requestId,
                data.userId,
                data.shopifyCustomerId || null,
                data.status || 'pending',
                data.progressStep || 1,
                data.country || null,
                data.planType || null,
                data.serviceType || 'psa-grading',
                data.totalDeclaredValue || 0,
                data.totalEstimatedGradingFee || 0,
                data.adminNotes || null,
                data.customerNotes || null,
                now,
                now
            );

            // カード情報の追加
            if (data.cards && Array.isArray(data.cards)) {
                data.cards.forEach(card => {
                    const cardId = uuidv4();
                    queries.cards.create.run(
                        cardId,
                        requestId,
                        card.cardName,
                        card.declaredValue || 0,
                        card.estimatedGradingFee || 0,
                        null,
                        null,
                        null,
                        null,
                        now
                    );
                });
            }

            // 初期進捗ステップの作成（ステップ1: 申込受付）
            const progressId = uuidv4();
            queries.progress.create.run(
                progressId,
                requestId,
                1,
                '申込受付',
                'completed',
                'system',
                '申込受付完了',
                now
            );

            // ステップ2-6の初期化
            for (let step = 2; step <= 6; step++) {
                const stepNames = {
                    2: 'カード受領・検品',
                    3: '代行料お支払い',
                    4: 'PSA鑑定中',
                    5: '鑑定料お支払い',
                    6: '返送・完了'
                };

                queries.progress.create.run(
                    uuidv4(),
                    requestId,
                    step,
                    stepNames[step],
                    'pending',
                    null,
                    '',
                    now
                );
            }

            return requestId;
        });

        const requestId = createRequest(requestData);
        return this.getPSARequestById(requestId);
    }

    getPSARequestById(requestId) {
        const request = queries.requests.findById.get(requestId);
        if (!request) return null;

        const cards = queries.cards.findByRequestId.all(requestId);
        const progress = queries.progress.findByRequestId.all(requestId);

        return {
            ...request,
            cards,
            progress
        };
    }

    getAllPSARequests() {
        const requests = queries.requests.getAll.all();
        return requests.map(request => ({
            ...request,
            cards: queries.cards.findByRequestId.all(request.id),
            progress: queries.progress.findByRequestId.all(request.id)
        }));
    }

    getUserPSARequests(userId) {
        const requests = queries.requests.findByUserId.all(userId);
        return requests.map(request => ({
            ...request,
            cards: queries.cards.findByRequestId.all(request.id),
            progress: queries.progress.findByRequestId.all(request.id)
        }));
    }

    updatePSARequestStatus(requestId, status, adminNotes = null) {
        const now = new Date().toISOString();
        queries.requests.updateStatus.run(status, now, requestId);

        if (adminNotes) {
            const request = queries.requests.findById.get(requestId);
            queries.requests.update.run(
                status,
                request.progress_step,
                adminNotes,
                now,
                requestId
            );
        }

        return this.getPSARequestById(requestId);
    }

    updatePSARequestStep(requestId, stepNumber, stepData, updatedBy = 'admin') {
        const now = new Date().toISOString();

        // リクエストのprogress_stepを更新
        queries.requests.updateStep.run(stepNumber, now, requestId);

        // 進捗ステータスを更新
        const progressRecords = queries.progress.findByRequestId.all(requestId);
        const targetProgress = progressRecords.find(p => p.step_number === stepNumber);

        if (targetProgress) {
            queries.progress.updateStatus.run(
                stepData.status || 'current',
                updatedBy,
                stepData.notes || '',
                now,
                targetProgress.id
            );
        }

        // ステップ詳細データの保存/更新
        const existingDetail = queries.stepDetails.findByRequestAndStep.get(requestId, stepNumber);

        if (existingDetail) {
            queries.stepDetails.update.run(
                JSON.stringify(stepData),
                now,
                existingDetail.id
            );
        } else {
            queries.stepDetails.create.run(
                uuidv4(),
                requestId,
                stepNumber,
                JSON.stringify(stepData),
                now,
                now
            );
        }

        return this.getPSARequestById(requestId);
    }

    // メッセージ管理
    createMessage(messageData) {
        const messageId = uuidv4();
        const now = new Date().toISOString();

        queries.messages.create.run(
            messageId,
            messageData.requestId || null,
            messageData.from,
            messageData.to,
            messageData.message,
            0,
            now
        );

        return messageId;
    }

    getMessagesForRequest(requestId) {
        return queries.messages.findByRequestId.all(requestId);
    }

    getUnreadMessageCount(userId) {
        return queries.messages.getUnreadCount.get(userId).count;
    }

    markMessageAsRead(messageId) {
        queries.messages.markAsRead.run(messageId);
    }

    // 管理者ログ
    logAdminAction(actionData) {
        const logId = uuidv4();
        const now = new Date().toISOString();

        queries.adminLogs.create.run(
            logId,
            actionData.adminUser,
            actionData.action,
            actionData.targetRequestId || null,
            actionData.targetUserId || null,
            actionData.details || null,
            actionData.ipAddress || null,
            now
        );
    }

    getRecentAdminLogs(limit = 100) {
        return queries.adminLogs.getRecent.all(limit);
    }

    // 買取承認管理
    createApproval(approvalData) {
        const createApprovalTx = transaction((data) => {
            const approvalId = uuidv4();
            const now = new Date().toISOString();

            queries.approvals.create.run(
                approvalId,
                data.approvalKey,
                data.customerName,
                data.customerEmail,
                data.totalPrice || 0,
                'pending',
                now,
                now
            );

            if (data.cards && Array.isArray(data.cards)) {
                data.cards.forEach(card => {
                    queries.approvalCards.create.run(
                        uuidv4(),
                        approvalId,
                        card.name,
                        card.price,
                        'pending'
                    );
                });
            }

            return approvalId;
        });

        const approvalId = createApprovalTx(approvalData);
        return this.getApprovalByKey(approvalData.approvalKey);
    }

    getApprovalByKey(approvalKey) {
        const approval = queries.approvals.findByKey.get(approvalKey);
        if (!approval) return null;

        const cards = queries.approvalCards.findByApprovalId.all(approval.id);
        return { ...approval, cards };
    }

    getAllApprovals() {
        const approvals = queries.approvals.getAll.all();
        return approvals.map(approval => ({
            ...approval,
            cards: queries.approvalCards.findByApprovalId.all(approval.id)
        }));
    }

    updateApprovalStatus(approvalKey, status) {
        const approval = queries.approvals.findByKey.get(approvalKey);
        if (!approval) return null;

        const now = new Date().toISOString();
        queries.approvals.updateStatus.run(status, now, approval.id);

        return this.getApprovalByKey(approvalKey);
    }

    // サービス状況管理
    getAllServiceStatus() {
        return queries.serviceStatus.getAll.all();
    }

    updateServiceStatus(serviceId, status) {
        const now = new Date().toISOString();
        queries.serviceStatus.update.run(status, now, serviceId);
    }

    // 発送スケジュール管理
    getShippingSchedule(country = null) {
        if (country) {
            return queries.shippingSchedule.getByCountry.get(country);
        }
        return queries.shippingSchedule.getAll.all();
    }

    updateShippingSchedule(country, scheduleData) {
        const now = new Date().toISOString();
        queries.shippingSchedule.update.run(
            scheduleData.nextShipDate,
            scheduleData.notes || '',
            now,
            country
        );
        return queries.shippingSchedule.getByCountry.get(country);
    }

    // 統計情報
    getStatistics() {
        const requests = queries.requests.getAll.all();
        const users = queries.users.getAll.all();

        const stats = {
            totalUsers: users.length,
            totalRequests: requests.length,
            pendingRequests: requests.filter(r => r.status === 'pending').length,
            inProgressRequests: requests.filter(r => r.status === 'in_progress').length,
            completedRequests: requests.filter(r => r.status === 'completed').length,
            requestsByCountry: {
                usa: requests.filter(r => r.country === 'usa').length,
                japan: requests.filter(r => r.country === 'japan').length
            },
            requestsByPlan: {
                'value-bulk': requests.filter(r => r.plan_type === 'value-bulk').length,
                'economy': requests.filter(r => r.plan_type === 'economy').length,
                'standard': requests.filter(r => r.plan_type === 'standard').length,
                'express': requests.filter(r => r.plan_type === 'express').length
            }
        };

        return stats;
    }
}

module.exports = new DatabaseService();
