/**
 * JSONファイルからSQLiteデータベースへのデータ移行スクリプト
 */
const fs = require('fs');
const path = require('path');
const dbService = require('./services/database-service');

const DATA_DIR = './data';

function loadJSONFile(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error loading ${filename}:`, error);
            return null;
        }
    }
    return null;
}

async function migrateApplications() {
    console.log('Migrating applications...');
    const applications = loadJSONFile('applications.json');

    if (!applications || !Array.isArray(applications)) {
        console.log('No applications data found.');
        return;
    }

    for (const app of applications) {
        try {
            // ユーザーの作成または取得
            const user = dbService.findOrCreateUser({
                email: app.customerEmail || `user-${app.id}@example.com`,
                name: app.customerName || 'Unknown',
                phone: app.phoneNumber || null
            });

            // PSAリクエストの作成
            const requestData = {
                userId: user.id,
                status: app.status || 'pending',
                progressStep: app.currentStatus ? 1 : 1,
                country: app.country || null,
                planType: app.planType || null,
                serviceType: app.serviceType || 'psa-grading',
                totalDeclaredValue: app.totalDeclaredValue || 0,
                totalEstimatedGradingFee: app.totalEstimatedGradingFee || 0,
                customerNotes: app.notes || null,
                cards: app.cards || []
            };

            const request = dbService.createPSARequest(requestData);
            console.log(`✓ Migrated application: ${app.id} -> ${request.id}`);
        } catch (error) {
            console.error(`Error migrating application ${app.id}:`, error);
        }
    }
}

async function migrateApprovals() {
    console.log('Migrating approvals...');
    const approvals = loadJSONFile('approvals.json');

    if (!approvals || !Array.isArray(approvals)) {
        console.log('No approvals data found.');
        return;
    }

    for (const approval of approvals) {
        try {
            const approvalData = {
                approvalKey: approval.approvalKey,
                customerName: approval.customerName,
                customerEmail: approval.customerEmail,
                totalPrice: approval.totalPrice || 0,
                cards: approval.cards || []
            };

            dbService.createApproval(approvalData);
            console.log(`✓ Migrated approval: ${approval.approvalKey}`);
        } catch (error) {
            console.error(`Error migrating approval ${approval.approvalKey}:`, error);
        }
    }
}

async function migrateServiceStatus() {
    console.log('Migrating service status...');
    const serviceStatus = loadJSONFile('service_status.json');

    if (!serviceStatus || !serviceStatus.services) {
        console.log('No service status data found.');
        return;
    }

    for (const service of serviceStatus.services) {
        try {
            dbService.updateServiceStatus(service.id, service.status);
            console.log(`✓ Migrated service status: ${service.id}`);
        } catch (error) {
            console.error(`Error migrating service ${service.id}:`, error);
        }
    }
}

async function migrateSchedule() {
    console.log('Migrating shipping schedule...');
    const schedule = loadJSONFile('schedule.json');

    if (!schedule) {
        console.log('No schedule data found.');
        return;
    }

    if (schedule.usa) {
        try {
            dbService.updateShippingSchedule('usa', {
                nextShipDate: schedule.usa.nextShipDate,
                notes: schedule.usa.notes || ''
            });
            console.log('✓ Migrated USA shipping schedule');
        } catch (error) {
            console.error('Error migrating USA schedule:', error);
        }
    }

    if (schedule.japan) {
        try {
            dbService.updateShippingSchedule('japan', {
                nextShipDate: schedule.japan.nextShipDate,
                notes: schedule.japan.notes || ''
            });
            console.log('✓ Migrated Japan shipping schedule');
        } catch (error) {
            console.error('Error migrating Japan schedule:', error);
        }
    }
}

async function migrate() {
    console.log('=== Starting Data Migration ===\n');

    try {
        await migrateApplications();
        await migrateApprovals();
        await migrateServiceStatus();
        await migrateSchedule();

        console.log('\n=== Migration Completed Successfully ===');
        console.log('Summary:');
        const stats = dbService.getStatistics();
        console.log(`- Total Users: ${stats.totalUsers}`);
        console.log(`- Total Requests: ${stats.totalRequests}`);
        console.log(`- Total Approvals: ${dbService.getAllApprovals().length}`);
    } catch (error) {
        console.error('\n=== Migration Failed ===');
        console.error(error);
        process.exit(1);
    }
}

// スクリプトとして実行された場合
if (require.main === module) {
    migrate();
}

module.exports = { migrate };
