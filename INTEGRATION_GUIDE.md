# 利用者サイト連携ガイド

## 概要
管理者サイト (https://kanucard-daiko-support.onrender.com) と利用者サイト (https://new-daiko-form.onrender.com) を連携させるための実装ガイドです。

## 利用可能な公開API

管理者サイトは以下の公開APIエンドポイントを提供しています：

### 1. 発送スケジュール取得
```
GET https://kanucard-daiko-support.onrender.com/api/public/schedule
```

**レスポンス例:**
```json
{
  "success": true,
  "data": {
    "usa": {
      "nextShipDate": "2025-11-15T00:00:00.000Z",
      "notes": "感謝祭のため少し遅れる可能性があります"
    },
    "japan": {
      "nextShipDate": "2025-11-20T00:00:00.000Z",
      "notes": "通常通り発送予定"
    },
    "lastUpdated": "2025-10-12T10:00:00.000Z"
  }
}
```

### 2. サービス状況取得
```
GET https://kanucard-daiko-support.onrender.com/api/public/service-status
```

**レスポンス例:**
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "psa-submission",
        "name": "PSA代行申込",
        "status": "active"
      },
      {
        "id": "grading-status",
        "name": "鑑定状況確認",
        "status": "active"
      },
      {
        "id": "purchase-approval",
        "name": "買取承認",
        "status": "inactive"
      }
    ],
    "announcement": "年末年始の営業時間についてのお知らせ..."
  }
}
```

### 3. 買取承認詳細取得
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

### 4. 買取承認回答送信
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

### 1. 発送スケジュール表示

```javascript
// 発送スケジュール取得と表示
async function displayShippingSchedule() {
  try {
    const response = await fetch('https://kanucard-daiko-support.onrender.com/api/public/schedule');
    const data = await response.json();

    if (data.success) {
      const schedule = data.data;

      // アメリカ発送スケジュール
      if (schedule.usa?.nextShipDate) {
        const usaDate = new Date(schedule.usa.nextShipDate);
        document.getElementById('usa-ship-date').textContent =
          usaDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        if (schedule.usa.notes) {
          document.getElementById('usa-ship-notes').textContent = schedule.usa.notes;
        }
      }

      // 日本発送スケジュール
      if (schedule.japan?.nextShipDate) {
        const japanDate = new Date(schedule.japan.nextShipDate);
        document.getElementById('japan-ship-date').textContent =
          japanDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        if (schedule.japan.notes) {
          document.getElementById('japan-ship-notes').textContent = schedule.japan.notes;
        }
      }

      // 最終更新日時
      if (schedule.lastUpdated) {
        const lastUpdated = new Date(schedule.lastUpdated);
        document.getElementById('schedule-last-updated').textContent =
          `最終更新: ${lastUpdated.toLocaleString('ja-JP')}`;
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

    if (data.success) {
      const serviceStatus = data.data;

      // サービス一覧表示
      const servicesContainer = document.getElementById('services-status');
      servicesContainer.innerHTML = '';

      serviceStatus.services.forEach(service => {
        const serviceElement = document.createElement('div');
        serviceElement.className = `service-item ${service.status}`;
        serviceElement.innerHTML = `
          <div class="service-name">${service.name}</div>
          <div class="service-status">
            ${service.status === 'active' ? '✅ 利用可能' : '⚠️ 現在停止中'}
          </div>
        `;
        servicesContainer.appendChild(serviceElement);
      });

      // お知らせ表示
      if (serviceStatus.announcement) {
        document.getElementById('announcement-banner').style.display = 'block';
        document.getElementById('announcement-text').textContent = serviceStatus.announcement;
      } else {
        document.getElementById('announcement-banner').style.display = 'none';
      }
    }
  } catch (error) {
    console.error('サービス状況の取得に失敗しました:', error);
  }
}

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', displayServiceStatus);
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

管理者サイトはCORS設定により、https://new-daiko-form.onrender.com からのアクセスを許可しています。
ローカル開発環境でテストする場合は、管理者にCORS設定の追加を依頼してください。

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

- 発送スケジュール: 5分ごと
- サービス状況: ページ読み込み時
- 承認情報: リアルタイム（ユーザーアクション時）

## サポート

実装に関する質問や追加のAPI要件については、管理者にお問い合わせください。