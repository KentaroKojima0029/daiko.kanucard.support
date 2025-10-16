// サンプルデータ作成スクリプト
const dbService = require('./services/database-service');
const { initializeDatabase } = require('./database');

console.log('データベース初期化中...');
initializeDatabase();

console.log('サンプルデータ作成中...');

// 1. サンプルユーザーの作成
const sampleUser = dbService.findOrCreateUser({
    email: 'sample.customer@example.com',
    name: '山田太郎',
    phone: '090-1234-5678'
});

console.log('✓ サンプルユーザー作成:', sampleUser.id);

// 2. サンプルカード情報
const sampleCards = [
    {
        cardName: 'ピカチュウ VMAX CSR',
        quantity: 1,
        declaredValue: 50000,
        acquisitionValue: 45000
    },
    {
        cardName: 'リザードン V SSR',
        quantity: 1,
        declaredValue: 30000,
        acquisitionValue: 28000
    },
    {
        cardName: 'ミュウツー GX',
        quantity: 2,
        declaredValue: 15000,
        acquisitionValue: 13000
    }
];

// 3. PSA代行申込の作成
const sampleRequest = dbService.createPSARequest({
    userId: sampleUser.id,
    shopifyCustomerId: null,
    status: 'in_progress',
    country: 'usa',
    planType: 'normal',
    serviceType: 'psa-grading',
    totalDeclaredValue: 110000,
    totalEstimatedGradingFee: 12000,
    customerNotes: 'サンプルデータです。PSA10を目指しています。',
    cards: sampleCards
});

console.log('✓ サンプル申込作成:', sampleRequest.id);
console.log('  - 顧客名:', sampleUser.name);
console.log('  - カード数:', sampleCards.length);
console.log('  - プラン: アメリカ・ノーマル');
console.log('  - 総申告価格: ¥110,000');

// 4. 進捗状況の更新
console.log('\n進捗状況を更新中...');

// ステップ1: 申込受付（完了）
dbService.updatePSARequestStep(sampleRequest.id, 1, {
    status: 'completed',
    notes: '申込を受け付けました'
}, 'system');

// ステップ2: カード受領・検品（完了）
dbService.updatePSARequestStep(sampleRequest.id, 2, {
    status: 'completed',
    notes: 'カード3種類、合計4枚を受領しました。状態確認完了。'
}, 'collection@kanucard.com');

// ステップ3: 代行料お支払い（現在進行中）
dbService.updatePSARequestStep(sampleRequest.id, 3, {
    status: 'current',
    notes: '代行料 ¥12,000 のお支払いをお待ちしております。'
}, 'collection@kanucard.com');

// ステップ4-6: 未完了
dbService.updatePSARequestStep(sampleRequest.id, 4, {
    status: 'pending',
    notes: ''
}, 'system');

dbService.updatePSARequestStep(sampleRequest.id, 5, {
    status: 'pending',
    notes: ''
}, 'system');

dbService.updatePSARequestStep(sampleRequest.id, 6, {
    status: 'pending',
    notes: ''
}, 'system');

console.log('✓ 進捗更新完了');
console.log('  - ステップ1: 完了');
console.log('  - ステップ2: 完了');
console.log('  - ステップ3: 進行中');

// 5. サンプルメッセージの作成
const messageId = dbService.createMessage({
    requestId: sampleRequest.id,
    from: 'collection@kanucard.com',
    to: sampleUser.email,
    message: 'カードを受領いたしました。状態は良好です。代行料のお支払いをお願いいたします。'
});

console.log('✓ サンプルメッセージ作成:', messageId);

// 6. 確認用情報の表示
console.log('\n' + '='.repeat(60));
console.log('サンプルデータ作成完了！');
console.log('='.repeat(60));
console.log('\n【フロントエンドでの確認方法】');
console.log('\n1. 進捗確認ページ (https://daiko.kanucard.com/status)');
console.log('   申込ID:', sampleRequest.id);
console.log('   API URL: https://kanucard-daiko-support.onrender.com/api/public/application/' + sampleRequest.id + '/progress');
console.log('\n2. 利用方法:');
console.log('   fetch("https://kanucard-daiko-support.onrender.com/api/public/application/' + sampleRequest.id + '/progress")');
console.log('     .then(res => res.json())');
console.log('     .then(data => console.log(data));');
console.log('\n3. 管理者ダッシュボード:');
console.log('   https://kanucard-daiko-support.onrender.com');
console.log('   ※認証なしでアクセス可能（開発環境）');
console.log('\n' + '='.repeat(60));
