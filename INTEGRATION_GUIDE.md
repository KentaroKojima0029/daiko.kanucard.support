# 利用者サイト連携ガイド

## 概要
管理者サイト (https://kanucard-daiko-support.onrender.com) と利用者サイト (https://new-daiko-form.onrender.com) を連携させるための実装ガイドです。

このガイドでは、SQLiteデータベースを使用した統合システムの公開APIを利用して、利用者サイトから必要な情報を取得する方法を説明します。

## システム構成

- **管理者サイト**: バックエンドAPI + 管理者ダッシュボード (SQLiteデータベース)
- **利用者サイト**: フロントエンドのみ (管理者サイトのAPIを利用)
- **データベース**: SQLite (11テーブル構成)
- **認証**: 管理者API用JWT認証、公開APIは認証不要

## 利用可能な公開API

管理者サイトは以下の公開APIエンドポイントを提供しています（CORS対応済み）：

### 1. 発送スケジュール取得
```
GET https://kanucard-daiko-support.onrender.com/api/public/schedule
```

アメリカと日本の発送スケジュールを取得します。国別に管理されています。

**レスポンス例:**
```json
{
  "success": true,
  "data": [
    {
      "id": "schedule-usa",
      "country": "usa",
      "next_ship_date": "2025-11-15",
      "notes": "感謝祭のため少し遅れる可能性があります",
      "last_updated": "2025-10-12T10:00:00.000Z"
    },
    {
      "id": "schedule-japan",
      "country": "japan",
      "next_ship_date": "2025-11-20",
      "notes": "通常通り発送予定",
      "last_updated": "2025-10-12T10:00:00.000Z"
    }
  ]
}
```

### 2. サービス状況取得
```
GET https://kanucard-daiko-support.onrender.com/api/public/service-status
```

各サービスの稼働状況を取得します。

**レスポンス例:**
```json
{
  "success": true,
  "data": [
    {
      "id": "psa-submission",
      "service_id": "psa-submission",
      "name": "PSA代行申込",
      "status": "active",
      "description": "PSAグレーディング代行申込サービス",
      "last_updated": "2025-10-12T10:00:00.000Z"
    },
    {
      "id": "grading-status",
      "service_id": "grading-status",
      "name": "鑑定状況確認",
      "status": "active",
      "description": "鑑定進捗状況確認サービス",
      "last_updated": "2025-10-12T10:00:00.000Z"
    },
    {
      "id": "purchase-approval",
      "service_id": "purchase-approval",
      "name": "買取承認",
      "status": "inactive",
      "description": "カード買取承認サービス",
      "last_updated": "2025-10-12T10:00:00.000Z"
    }
  ]
}
```

### 3. PSA代行申込進捗取得
```
GET https://kanucard-daiko-support.onrender.com/api/public/application/:applicationId/progress
```

特定のPSA代行申込の進捗状況を取得します（6ステップの進捗管理）。

**パラメータ:**
- `applicationId`: 申込ID

**レスポンス例:**
```json
{
  "success": true,
  "data": {
    "applicationId": "req-abc123",
    "status": "in_progress",
    "currentStep": 3,
    "progress": [
      {
        "id": "prog-1",
        "step_number": 1,
        "step_name": "申込受付",
        "status": "completed",
        "updated_by": "system",
        "notes": "申込受付完了",
        "timestamp": "2025-10-01T10:00:00.000Z"
      },
      {
        "id": "prog-2",
        "step_number": 2,
        "step_name": "カード受領・検品",
        "status": "completed",
        "updated_by": "admin@example.com",
        "notes": "カード3枚受領・検品完了",
        "timestamp": "2025-10-05T14:30:00.000Z"
      },
      {
        "id": "prog-3",
        "step_number": 3,
        "step_name": "代行料お支払い",
        "status": "current",
        "updated_by": "admin@example.com",
        "notes": "代行料のお支払いをお待ちしています",
        "timestamp": "2025-10-06T09:00:00.000Z"
      },
      {
        "id": "prog-4",
        "step_number": 4,
        "step_name": "PSA鑑定中",
        "status": "pending",
        "updated_by": null,
        "notes": "",
        "timestamp": "2025-10-01T10:00:00.000Z"
      },
      {
        "id": "prog-5",
        "step_number": 5,
        "step_name": "鑑定料お支払い",
        "status": "pending",
        "updated_by": null,
        "notes": "",
        "timestamp": "2025-10-01T10:00:00.000Z"
      },
      {
        "id": "prog-6",
        "step_number": 6,
        "step_name": "返送・完了",
        "status": "pending",
        "updated_by": null,
        "notes": "",
        "timestamp": "2025-10-01T10:00:00.000Z"
      }
    ]
  }
}
```

### 4. 買取承認詳細取得
```
GET https://kanucard-daiko-support.onrender.com/api/public/approval/{approvalKey}
```

**レスポンス例:**
```json
{
  "success": true,
  "data": {
    "approvalKey": "APP-12345678",
    "customerName": "山田太郎",
    "cards": [
      {
        "name": "ピカチュウ VMAX",
        "price": 50000,
        "status": "pending"
      }
    ],
    "totalPrice": 50000,
    "status": "pending",
    "createdAt": "2025-10-12T10:00:00.000Z"
  }
}
```

### 5. 買取承認回答送信
```
POST https://kanucard-daiko-support.onrender.com/api/public/approval/{approvalKey}/response
```

**リクエストボディ:**
```json
{
  "cardResponses": [
    {
      "cardId": "card-1",
      "decision": "approved"
    },
    {
      "cardId": "card-2",
      "decision": "rejected"
    }
  ],
  "comment": "カード1は承認しますが、カード2は価格が合わないため拒否します。"
}
```

## 利用者サイトでの実装例

### 0. PSA代行申込進捗表示

```javascript
// PSA代行申込の進捗状況を取得・表示
async function displayApplicationProgress(applicationId) {
  try {
    const response = await fetch(`https://kanucard-daiko-support.onrender.com/api/public/application/${applicationId}/progress`);
    const data = await response.json();

    if (data.success) {
      const progressData = data.data;

      // 現在のステップを表示
      document.getElementById('current-step').textContent =
        `ステップ ${progressData.currentStep}/6: ${progressData.progress.find(p => p.status === 'current')?.step_name}`;

      // ステータス表示
      const statusText = {
        'pending': '受付待ち',
        'in_progress': '進行中',
        'completed': '完了'
      };
      document.getElementById('status').textContent = statusText[progressData.status];

      // 進捗バーの更新
      const progressPercentage = (progressData.currentStep / 6) * 100;
      document.getElementById('progress-bar').style.width = `${progressPercentage}%`;

      // 各ステップの詳細を表示
      const stepsContainer = document.getElementById('progress-steps');
      stepsContainer.innerHTML = '';

      progressData.progress.forEach(step => {
        const stepElement = document.createElement('div');
        stepElement.className = `progress-step ${step.status}`;

        const statusIcon = {
          'completed': '✓',
          'current': '→',
          'pending': '○'
        };

        stepElement.innerHTML = `
          <div class="step-header">
            <span class="step-icon">${statusIcon[step.status]}</span>
            <span class="step-number">ステップ ${step.step_number}</span>
            <span class="step-name">${step.step_name}</span>
          </div>
          <div class="step-details">
            ${step.notes ? `<p class="step-notes">${step.notes}</p>` : ''}
            ${step.timestamp ? `<p class="step-time">更新: ${new Date(step.timestamp).toLocaleString('ja-JP')}</p>` : ''}
          </div>
        `;

        stepsContainer.appendChild(stepElement);
      });
    } else {
      document.getElementById('error-message').textContent = '進捗情報が見つかりません';
      document.getElementById('error-message').style.display = 'block';
    }
  } catch (error) {
    console.error('進捗情報の取得に失敗しました:', error);
    document.getElementById('error-message').textContent = 'エラーが発生しました';
    document.getElementById('error-message').style.display = 'block';
  }
}

// URLパラメータから申込IDを取得
const urlParams = new URLSearchParams(window.location.search);
const applicationId = urlParams.get('id');

if (applicationId) {
  displayApplicationProgress(applicationId);

  // 30秒ごとに進捗を自動更新
  setInterval(() => displayApplicationProgress(applicationId), 30 * 1000);
}
```

### 1. 発送スケジュール表示

```javascript
// 発送スケジュール取得と表示
async function displayShippingSchedule() {
  try {
    const response = await fetch('https://kanucard-daiko-support.onrender.com/api/public/schedule');
    const data = await response.json();

    if (data.success && Array.isArray(data.data)) {
      const schedules = data.data;

      // アメリカ発送スケジュール
      const usaSchedule = schedules.find(s => s.country === 'usa');
      if (usaSchedule && usaSchedule.next_ship_date) {
        const usaDate = new Date(usaSchedule.next_ship_date);
        document.getElementById('usa-ship-date').textContent =
          usaDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        if (usaSchedule.notes) {
          document.getElementById('usa-ship-notes').textContent = usaSchedule.notes;
        }

        if (usaSchedule.last_updated) {
          const lastUpdated = new Date(usaSchedule.last_updated);
          document.getElementById('usa-last-updated').textContent =
            `最終更新: ${lastUpdated.toLocaleString('ja-JP')}`;
        }
      }

      // 日本発送スケジュール
      const japanSchedule = schedules.find(s => s.country === 'japan');
      if (japanSchedule && japanSchedule.next_ship_date) {
        const japanDate = new Date(japanSchedule.next_ship_date);
        document.getElementById('japan-ship-date').textContent =
          japanDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        if (japanSchedule.notes) {
          document.getElementById('japan-ship-notes').textContent = japanSchedule.notes;
        }

        if (japanSchedule.last_updated) {
          const lastUpdated = new Date(japanSchedule.last_updated);
          document.getElementById('japan-last-updated').textContent =
            `最終更新: ${lastUpdated.toLocaleString('ja-JP')}`;
        }
      }
    }
  } catch (error) {
    console.error('発送スケジュールの取得に失敗しました:', error);
    // エラー時の処理
    document.getElementById('schedule-error').style.display = 'block';
  }
}

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', displayShippingSchedule);

// 5分ごとに更新
setInterval(displayShippingSchedule, 5 * 60 * 1000);
```

### 2. サービス状況表示

```javascript
// サービス状況取得と表示
async function displayServiceStatus() {
  try {
    const response = await fetch('https://kanucard-daiko-support.onrender.com/api/public/service-status');
    const data = await response.json();

    if (data.success && Array.isArray(data.data)) {
      const services = data.data;

      // サービス一覧表示
      const servicesContainer = document.getElementById('services-status');
      servicesContainer.innerHTML = '';

      services.forEach(service => {
        const serviceElement = document.createElement('div');
        serviceElement.className = `service-item ${service.status}`;
        serviceElement.innerHTML = `
          <div class="service-info">
            <div class="service-name">${service.name}</div>
            ${service.description ? `<div class="service-description">${service.description}</div>` : ''}
          </div>
          <div class="service-status">
            ${service.status === 'active' ? '<span class="badge active">✓ 利用可能</span>' : '<span class="badge inactive">✕ 停止中</span>'}
          </div>
          ${service.last_updated ? `<div class="service-updated">更新: ${new Date(service.last_updated).toLocaleDateString('ja-JP')}</div>` : ''}
        `;
        servicesContainer.appendChild(serviceElement);
      });
    }
  } catch (error) {
    console.error('サービス状況の取得に失敗しました:', error);
    document.getElementById('services-error').style.display = 'block';
  }
}

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', displayServiceStatus);

// 1分ごとに更新
setInterval(displayServiceStatus, 60 * 1000);
```

### 3. 買取承認画面

```javascript
// 承認キーから承認情報を取得
async function loadApprovalDetails(approvalKey) {
  try {
    const response = await fetch(`https://kanucard-daiko-support.onrender.com/api/public/approval/${approvalKey}`);
    const data = await response.json();

    if (data.success) {
      const approval = data.data;

      // 顧客名表示
      document.getElementById('customer-name').textContent = approval.customerName;

      // カード一覧表示
      const cardsContainer = document.getElementById('cards-list');
      cardsContainer.innerHTML = '';

      approval.cards.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card-item';
        cardElement.innerHTML = `
          <div class="card-info">
            <h3>${card.name}</h3>
            <p class="card-price">買取価格: ¥${card.price.toLocaleString()}</p>
          </div>
          <div class="card-actions">
            <label>
              <input type="radio" name="card-${index}" value="approved" data-card-id="${card.id}">
              承認
            </label>
            <label>
              <input type="radio" name="card-${index}" value="rejected" data-card-id="${card.id}">
              拒否
            </label>
            <label>
              <input type="radio" name="card-${index}" value="pending" data-card-id="${card.id}">
              保留
            </label>
          </div>
        `;
        cardsContainer.appendChild(cardElement);
      });

      // 合計金額表示
      document.getElementById('total-price').textContent = `¥${approval.totalPrice.toLocaleString()}`;

      // 承認ボタンにイベントリスナー追加
      document.getElementById('submit-response').addEventListener('click', () => {
        submitApprovalResponse(approvalKey);
      });
    } else {
      // エラー表示
      document.getElementById('error-message').textContent = '承認情報が見つかりません';
      document.getElementById('error-message').style.display = 'block';
    }
  } catch (error) {
    console.error('承認情報の取得に失敗しました:', error);
    document.getElementById('error-message').textContent = 'エラーが発生しました';
    document.getElementById('error-message').style.display = 'block';
  }
}

// 承認回答を送信
async function submitApprovalResponse(approvalKey) {
  const cardResponses = [];

  // 各カードの選択を取得
  document.querySelectorAll('[data-card-id]').forEach(input => {
    if (input.checked) {
      cardResponses.push({
        cardId: input.dataset.cardId,
        decision: input.value
      });
    }
  });

  // コメント取得
  const comment = document.getElementById('comment').value;

  try {
    const response = await fetch(`https://kanucard-daiko-support.onrender.com/api/public/approval/${approvalKey}/response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cardResponses: cardResponses,
        comment: comment
      })
    });

    const data = await response.json();

    if (data.success) {
      // 成功メッセージ表示
      alert('回答を送信しました');
      window.location.href = '/approval-complete';
    } else {
      alert('送信に失敗しました: ' + data.error);
    }
  } catch (error) {
    console.error('回答送信エラー:', error);
    alert('エラーが発生しました');
  }
}

// URLパラメータから承認キーを取得
const urlParams = new URLSearchParams(window.location.search);
const approvalKey = urlParams.get('key');

if (approvalKey) {
  loadApprovalDetails(approvalKey);
}
```

## HTMLテンプレート例

### PSA代行申込進捗表示部分
```html
<div class="application-progress">
  <h2>PSA代行申込進捗</h2>

  <!-- 現在のステータス -->
  <div class="status-bar">
    <div class="status-text">
      <span id="status">読み込み中...</span>
      <span id="current-step">-</span>
    </div>
    <div class="progress-bar-container">
      <div id="progress-bar" class="progress-bar" style="width: 0%;"></div>
    </div>
  </div>

  <!-- 進捗ステップ詳細 -->
  <div id="progress-steps" class="progress-steps">
    <!-- JavaScriptで動的に生成 -->
  </div>

  <!-- エラーメッセージ -->
  <div class="error-message" id="error-message" style="display: none;"></div>
</div>

<style>
.application-progress {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.status-bar {
  margin-bottom: 30px;
}

.status-text {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-weight: bold;
}

.progress-bar-container {
  width: 100%;
  height: 30px;
  background-color: #e0e0e0;
  border-radius: 15px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
  transition: width 0.5s ease;
}

.progress-steps {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.progress-step {
  border: 2px solid #ddd;
  border-radius: 10px;
  padding: 15px;
  transition: all 0.3s ease;
}

.progress-step.completed {
  background-color: #e8f5e9;
  border-color: #4CAF50;
}

.progress-step.current {
  background-color: #fff3e0;
  border-color: #FF9800;
  box-shadow: 0 4px 8px rgba(255, 152, 0, 0.2);
}

.progress-step.pending {
  background-color: #fafafa;
  border-color: #ddd;
  opacity: 0.7;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.step-icon {
  font-size: 24px;
  font-weight: bold;
}

.step-completed .step-icon {
  color: #4CAF50;
}

.step-current .step-icon {
  color: #FF9800;
}

.step-number {
  font-weight: bold;
  color: #666;
}

.step-name {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.step-details {
  padding-left: 44px;
}

.step-notes {
  margin: 5px 0;
  color: #555;
}

.step-time {
  margin: 5px 0;
  font-size: 12px;
  color: #999;
}
</style>
```

### 発送スケジュール表示部分
```html
<div class="shipping-schedule">
  <h2>発送スケジュール</h2>

  <div class="schedule-grid">
    <!-- アメリカ発送 -->
    <div class="schedule-card">
      <h3>🇺🇸 アメリカ発送</h3>
      <p class="ship-date" id="usa-ship-date">読み込み中...</p>
      <p class="ship-notes" id="usa-ship-notes"></p>
    </div>

    <!-- 日本発送 -->
    <div class="schedule-card">
      <h3>🇯🇵 日本発送</h3>
      <p class="ship-date" id="japan-ship-date">読み込み中...</p>
      <p class="ship-notes" id="japan-ship-notes"></p>
    </div>
  </div>

  <p class="last-updated" id="schedule-last-updated"></p>
  <div class="error-message" id="schedule-error" style="display: none;">
    スケジュール情報を取得できませんでした
  </div>
</div>
```

### サービス状況表示部分
```html
<div class="service-status">
  <!-- お知らせバナー -->
  <div class="announcement-banner" id="announcement-banner" style="display: none;">
    <p id="announcement-text"></p>
  </div>

  <!-- サービス一覧 -->
  <div class="services-grid" id="services-status">
    <!-- JavaScriptで動的に生成 -->
  </div>
</div>
```

## CORS設定について

管理者サイトはCORS設定により、以下のオリジンからのアクセスを許可しています:
- `https://new-daiko-form.onrender.com` (本番環境)
- `http://localhost:*` (ローカル開発環境)

ローカル開発環境でテストする場合、特別な設定は不要です。

### CORS設定の確認

サーバー側のCORS設定 (server.js):
```javascript
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://new-daiko-form.onrender.com',
      'http://localhost:3000',
      'http://localhost:5000',
      'http://localhost:8080'
    ];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};
```

## エラーハンドリング

すべてのAPI呼び出しでは適切なエラーハンドリングを実装してください：

```javascript
try {
  const response = await fetch('API_URL');

  // HTTPステータスコードの確認
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  // APIレスポンスの成功フラグ確認
  if (!data.success) {
    throw new Error(data.error || 'APIエラーが発生しました');
  }

  // 正常処理
  // ...
} catch (error) {
  console.error('APIエラー:', error);
  // ユーザー向けエラー表示
  // ...
}
```

## 更新頻度の推奨

- **PSA代行申込進捗**: 30秒ごと（リアルタイム性が重要）
- **発送スケジュール**: 5分ごと
- **サービス状況**: 1分ごと
- **買取承認情報**: リアルタイム（ユーザーアクション時）

## データベース連携について

### データフロー

```
利用者サイト (Frontend)
    ↓ HTTPS/REST API
管理者サイト (Backend)
    ↓
SQLiteデータベース
    ├── users (ユーザー情報)
    ├── psa_requests (PSA代行依頼)
    ├── progress_tracking (進捗管理)
    ├── messages (メッセージ)
    ├── approvals (買取承認)
    ├── service_status (サービス状況)
    └── shipping_schedule (発送スケジュール)
```

### データの整合性

- すべてのAPIレスポンスは`success`フラグを含みます
- エラー時は`error`プロパティにエラーメッセージが含まれます
- タイムスタンプはISO 8601形式 (例: `2025-10-12T10:00:00.000Z`)
- 日付のみはYYYY-MM-DD形式 (例: `2025-11-15`)

### キャッシング戦略

公開APIは高頻度でアクセスされる可能性があるため、クライアント側でのキャッシングを推奨:

```javascript
// 簡単なキャッシング実装例
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5分

async function fetchWithCache(url) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const response = await fetch(url);
  const data = await response.json();

  cache.set(url, {
    data: data,
    timestamp: Date.now()
  });

  return data;
}

// 使用例
const scheduleData = await fetchWithCache('https://kanucard-daiko-support.onrender.com/api/public/schedule');
```

## テスト方法

### ローカルテスト

1. 管理者サイトをローカルで起動:
```bash
cd kanucard-daiko-support
NODE_ENV=development node server.js
```

2. 利用者サイトのコードでAPIエンドポイントをローカルに変更:
```javascript
const API_BASE = 'http://localhost:3000';
```

3. ブラウザの開発者ツールでネットワークタブを開き、APIレスポンスを確認

### 本番環境テスト

```bash
# 発送スケジュールテスト
curl https://kanucard-daiko-support.onrender.com/api/public/schedule

# サービス状況テスト
curl https://kanucard-daiko-support.onrender.com/api/public/service-status

# 進捗確認テスト（実際の申込IDを使用）
curl https://kanucard-daiko-support.onrender.com/api/public/application/{申込ID}/progress
```

## トラブルシューティング

### 問題: CORS エラーが発生する

**解決策:**
- URLが正しいか確認
- ブラウザのコンソールでエラー詳細を確認
- ローカル開発の場合、localhostのポート番号を確認

### 問題: データが取得できない

**解決策:**
1. APIエンドポイントURLが正しいか確認
2. ブラウザのネットワークタブでレスポンスを確認
3. `success`フラグがfalseの場合、`error`メッセージを確認
4. 管理者サイトのヘルスチェックを確認: `GET /health`

### 問題: 進捗情報が表示されない

**解決策:**
- 申込IDが正しいか確認
- 該当の申込が存在するか管理者に確認
- APIレスポンスの`data`プロパティが空でないか確認

## サポート

実装に関する質問や追加のAPI要件については、以下を参照してください:
- **詳細ドキュメント**: `README_DATABASE.md`
- **データベーススキーマ**: `database.js`
- **サービス実装**: `services/database-service.js`