// グローバル変数
let agencyRequests = [];
let approvalRequests = [];
let allMessages = {};
let approvalCardCount = 0;
let currentMessageRequestId = null;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initApprovalForm();
  loadAllData();

  // イベントリスナー
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('refreshBtn').addEventListener('click', loadAllData);
  document.getElementById('createBackupBtn').addEventListener('click', createBackup);
  document.getElementById('agencyFilter').addEventListener('change', filterAgencyRequests);

  // 定期更新（30秒ごと）
  setInterval(loadAllData, 30000);
});

// テーマ管理
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('.theme-icon');
  icon.textContent = theme === 'light' ? '🌙' : '☀️';
}

// ナビゲーション
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      switchView(view);

      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

function switchView(viewName) {
  const views = document.querySelectorAll('.view');
  views.forEach(view => view.classList.remove('active'));

  const targetView = document.getElementById(`${viewName}View`);
  if (targetView) {
    targetView.classList.add('active');
  }

  // ビュー切り替え時のデータ更新
  if (viewName === 'messages') {
    loadMessagesView();
  } else if (viewName === 'backup') {
    loadBackups();
  }
}

// データ読み込み
async function loadAllData() {
  await Promise.all([
    loadAgencyRequests(),
    loadApprovalRequests()
  ]);
  updateStats();
}

async function loadAgencyRequests() {
  try {
    const response = await fetch('/api/agency-requests');
    agencyRequests = await response.json();
    displayAgencyRequests();
    displayRecentAgency();
  } catch (error) {
    console.error('代行案件読み込みエラー:', error);
  }
}

async function loadApprovalRequests() {
  try {
    const response = await fetch('/api/approval-requests');
    approvalRequests = await response.json();
    displayApprovalRequests();
    displayRecentApproval();
  } catch (error) {
    console.error('承認リスト読み込みエラー:', error);
  }
}

// 統計更新
function updateStats() {
  const agencyTotal = agencyRequests.length;
  const agencyPending = agencyRequests.filter(r => r.status === 'pending' || r.status === 'in_progress').length;
  const approvalTotal = approvalRequests.length;
  const approvalPending = approvalRequests.filter(r => r.status === 'pending').length;

  document.getElementById('statAgencyTotal').textContent = agencyTotal;
  document.getElementById('statAgencyPending').textContent = agencyPending;
  document.getElementById('statApprovalTotal').textContent = approvalTotal;
  document.getElementById('statApprovalPending').textContent = approvalPending;

  document.getElementById('agencyBadge').textContent = agencyPending;
  document.getElementById('approvalBadge').textContent = approvalPending;
}

// 代行案件表示
function displayAgencyRequests() {
  const tbody = document.getElementById('agencyTableBody');
  tbody.innerHTML = '';

  const filter = document.getElementById('agencyFilter').value;
  let filtered = agencyRequests;

  if (filter !== 'all') {
    filtered = agencyRequests.filter(r => r.status === filter);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">データがありません</td></tr>';
    return;
  }

  filtered.forEach(request => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(request.createdAt)}</td>
      <td>${request.customerName}</td>
      <td>${request.email}</td>
      <td>${request.phone || '-'}</td>
      <td>${request.cards.length}枚</td>
      <td><span class="status-badge status-${request.status}">${getStatusText(request.status)}</span></td>
      <td>
        <button class="btn btn-primary btn-small" onclick="showAgencyDetail('${request.requestId}')">
          詳細
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function filterAgencyRequests() {
  displayAgencyRequests();
}

function displayRecentAgency() {
  const tbody = document.getElementById('recentAgencyTable');
  tbody.innerHTML = '';

  const recent = agencyRequests.slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">データがありません</td></tr>';
    return;
  }

  recent.forEach(request => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(request.createdAt)}</td>
      <td>${request.customerName}</td>
      <td>${request.cards.length}枚</td>
      <td><span class="status-badge status-${request.status}">${getStatusText(request.status)}</span></td>
      <td>
        <button class="btn btn-primary btn-small" onclick="showAgencyDetail('${request.requestId}')">
          詳細
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// 案件詳細モーダル
function showAgencyDetail(requestId) {
  const request = agencyRequests.find(r => r.requestId === requestId);
  if (!request) return;

  const modal = document.getElementById('agencyDetailModal');
  const content = document.getElementById('agencyDetailContent');

  const cardsHtml = request.cards.map((card, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${card.playerName}</td>
      <td>${card.year || '-'}</td>
      <td>${card.cardName}</td>
      <td>${card.number || '-'}</td>
    </tr>
  `).join('');

  const progressHtml = request.progress.map(p => `
    <div class="timeline-item">
      <div class="timeline-time">${formatDate(p.timestamp)}</div>
      <div class="timeline-status">${getStatusText(p.status)}</div>
      ${p.note ? `<div class="timeline-note">${p.note}</div>` : ''}
    </div>
  `).join('');

  content.innerHTML = `
    <div class="card">
      <h4>顧客情報</h4>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">お名前:</span>
          <span class="value">${request.customerName}</span>
        </div>
        <div class="info-item">
          <span class="label">メール:</span>
          <span class="value">${request.email}</span>
        </div>
        <div class="info-item">
          <span class="label">電話:</span>
          <span class="value">${request.phone || '-'}</span>
        </div>
        <div class="info-item">
          <span class="label">予算:</span>
          <span class="value">${request.budget || '-'}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h4>カード情報</h4>
      <table class="data-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>選手名</th>
            <th>年</th>
            <th>カード名</th>
            <th>番号</th>
          </tr>
        </thead>
        <tbody>
          ${cardsHtml}
        </tbody>
      </table>
    </div>

    ${request.requirements ? `
      <div class="card">
        <h4>ご要望</h4>
        <p>${request.requirements}</p>
      </div>
    ` : ''}

    <div class="card">
      <h4>進捗状況</h4>
      <div class="timeline">
        ${progressHtml}
      </div>
    </div>

    <div class="card">
      <h4>ステータス変更</h4>
      <form onsubmit="updateAgencyStatus(event, '${requestId}')">
        <div class="form-row">
          <div class="form-group">
            <label>新しいステータス</label>
            <select id="newStatus" required>
              <option value="pending">受付中</option>
              <option value="in_progress">作業中</option>
              <option value="completed">完了</option>
              <option value="cancelled">キャンセル</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>備考</label>
          <textarea id="statusNote" rows="3" placeholder="顧客への連絡事項など"></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">ステータス更新</button>
        </div>
      </form>
    </div>
  `;

  modal.classList.add('show');
}

function closeAgencyDetailModal() {
  const modal = document.getElementById('agencyDetailModal');
  modal.classList.remove('show');
}

async function updateAgencyStatus(event, requestId) {
  event.preventDefault();

  const status = document.getElementById('newStatus').value;
  const note = document.getElementById('statusNote').value;

  try {
    const response = await fetch(`/api/agency-request/${requestId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage('ステータスを更新しました', 'success');
      closeAgencyDetailModal();
      loadAllData();
    } else {
      showMessage(data.error || '更新に失敗しました', 'error');
    }
  } catch (error) {
    console.error('ステータス更新エラー:', error);
    showMessage('更新に失敗しました', 'error');
  }
}

// 承認リスト表示
function displayApprovalRequests() {
  const tbody = document.getElementById('approvalTableBody');
  tbody.innerHTML = '';

  if (approvalRequests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">データがありません</td></tr>';
    return;
  }

  approvalRequests.forEach(request => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(request.createdAt)}</td>
      <td>${request.customerName}</td>
      <td>${request.email}</td>
      <td>${request.cards.length}枚</td>
      <td><span class="status-badge status-${request.status}">${request.status === 'completed' ? '完了' : '保留中'}</span></td>
      <td><span class="monospace">${request.approvalKey.substring(0, 8)}...</span></td>
    `;
    tbody.appendChild(row);
  });
}

function displayRecentApproval() {
  const tbody = document.getElementById('recentApprovalTable');
  tbody.innerHTML = '';

  const recent = approvalRequests.slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">データがありません</td></tr>';
    return;
  }

  recent.forEach(request => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(request.createdAt)}</td>
      <td>${request.customerName}</td>
      <td>${request.cards.length}枚</td>
      <td><span class="status-badge status-${request.status}">${request.status === 'completed' ? '完了' : '保留中'}</span></td>
    `;
    tbody.appendChild(row);
  });
}

// 承認フォーム
function initApprovalForm() {
  addApprovalCard();

  document.getElementById('addApprovalCardBtn').addEventListener('click', addApprovalCard);
  document.getElementById('approvalForm').addEventListener('submit', handleApprovalSubmit);
}

function addApprovalCard() {
  approvalCardCount++;
  const container = document.getElementById('approvalCardsContainer');

  const cardItem = document.createElement('div');
  cardItem.className = 'approval-card-item';
  cardItem.id = `approval-card-${approvalCardCount}`;

  cardItem.innerHTML = `
    <div class="approval-card-header">
      <h5>カード ${approvalCardCount}</h5>
      <button type="button" class="btn btn-danger" onclick="removeApprovalCard(${approvalCardCount})">削除</button>
    </div>
    <div class="approval-card-fields">
      <div class="form-group">
        <label>選手名 *</label>
        <input type="text" id="approvalPlayerName-${approvalCardCount}" required>
      </div>
      <div class="form-group">
        <label>年 *</label>
        <input type="text" id="approvalYear-${approvalCardCount}" required>
      </div>
      <div class="form-group">
        <label>カード名 *</label>
        <input type="text" id="approvalCardName-${approvalCardCount}" required>
      </div>
      <div class="form-group">
        <label>番号 *</label>
        <input type="text" id="approvalNumber-${approvalCardCount}" required>
      </div>
      <div class="form-group">
        <label>グレードレベル *</label>
        <select id="approvalGradeLevel-${approvalCardCount}" required>
          <option value="">選択</option>
          <option value="PSA 10">PSA 10</option>
          <option value="PSA 9">PSA 9</option>
          <option value="PSA 8">PSA 8</option>
          <option value="PSA 7">PSA 7</option>
          <option value="PSA 6">PSA 6</option>
          <option value="PSA 5">PSA 5</option>
        </select>
      </div>
    </div>
  `;

  container.appendChild(cardItem);
}

function removeApprovalCard(id) {
  const card = document.getElementById(`approval-card-${id}`);
  if (card) card.remove();

  if (document.getElementById('approvalCardsContainer').children.length === 0) {
    addApprovalCard();
  }
}

async function handleApprovalSubmit(event) {
  event.preventDefault();

  const customerName = document.getElementById('approvalCustomerName').value;
  const email = document.getElementById('approvalEmail').value;

  const cards = [];
  const cardItems = document.querySelectorAll('.approval-card-item');

  cardItems.forEach(item => {
    const id = item.id.split('-')[2];
    cards.push({
      playerName: document.getElementById(`approvalPlayerName-${id}`).value,
      year: document.getElementById(`approvalYear-${id}`).value,
      cardName: document.getElementById(`approvalCardName-${id}`).value,
      number: document.getElementById(`approvalNumber-${id}`).value,
      gradeLevel: document.getElementById(`approvalGradeLevel-${id}`).value
    });
  });

  try {
    const response = await fetch('/api/approval-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName, email, cards })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage('承認申請を送信しました', 'success');
      document.getElementById('approvalForm').reset();
      document.getElementById('approvalCardsContainer').innerHTML = '';
      approvalCardCount = 0;
      addApprovalCard();
      loadApprovalRequests();
    } else {
      showMessage(data.error || '送信に失敗しました', 'error');
    }
  } catch (error) {
    console.error('承認申請エラー:', error);
    showMessage('送信に失敗しました', 'error');
  }
}

// メッセージビュー
async function loadMessagesView() {
  const container = document.getElementById('requestsListContainer');
  container.innerHTML = '<p class="text-center">読み込み中...</p>';

  try {
    // すべての代行案件のメッセージを読み込む
    const messagePromises = agencyRequests.map(async (request) => {
      const response = await fetch(`/api/messages/${request.requestId}`);
      const messages = await response.json();
      return { requestId: request.requestId, messages, request };
    });

    const results = await Promise.all(messagePromises);

    container.innerHTML = '';

    results.forEach(({ requestId, messages, request }) => {
      const unread = messages.filter(m => !m.read && m.sender === 'customer').length;

      const item = document.createElement('div');
      item.className = `request-item ${unread > 0 ? 'unread' : ''}`;
      item.onclick = () => showMessageDetail(requestId, request, messages);

      const lastMessage = messages[messages.length - 1];

      item.innerHTML = `
        <div class="request-item-header">
          <span class="request-name">${request.customerName}</span>
          <span class="request-date">${formatDate(request.updatedAt)}</span>
        </div>
        <div class="request-preview">
          ${lastMessage ? lastMessage.message.substring(0, 40) + '...' : 'メッセージなし'}
        </div>
      `;

      container.appendChild(item);
    });

    if (results.length === 0) {
      container.innerHTML = '<p class="text-center">依頼がありません</p>';
    }

  } catch (error) {
    console.error('メッセージ読み込みエラー:', error);
    container.innerHTML = '<p class="text-center">読み込みに失敗しました</p>';
  }
}

async function showMessageDetail(requestId, request, messages) {
  currentMessageRequestId = requestId;

  const detail = document.getElementById('messageDetail');

  const messagesHtml = messages.map(msg => `
    <div class="message-item message-${msg.sender}">
      <div class="message-header">
        <span class="message-sender">${msg.senderName}</span>
        <span>${formatDate(msg.timestamp)}</span>
      </div>
      <div class="message-content">${msg.message}</div>
    </div>
  `).join('');

  detail.innerHTML = `
    <div class="message-detail-header">
      <h3>${request.customerName}</h3>
      <div class="message-detail-info">
        <span>📧 ${request.email}</span>
        <span>📅 ${formatDate(request.createdAt)}</span>
        <span class="status-badge status-${request.status}">${getStatusText(request.status)}</span>
      </div>
    </div>

    <div class="message-thread">
      ${messagesHtml.length > 0 ? messagesHtml : '<p class="text-center">メッセージがありません</p>'}
    </div>

    <form class="message-form" onsubmit="sendMessage(event, '${requestId}')">
      <textarea class="message-input" placeholder="メッセージを入力..." rows="3" required></textarea>
      <button type="submit" class="btn btn-primary">送信</button>
    </form>
  `;

  // 既読マーク
  await fetch(`/api/messages/${requestId}/read`, { method: 'PATCH' });

  // スクロール
  const thread = detail.querySelector('.message-thread');
  if (thread) thread.scrollTop = thread.scrollHeight;

  // アクティブ表示
  document.querySelectorAll('.request-item').forEach(item => item.classList.remove('active'));
  event.currentTarget?.classList.add('active');
}

async function sendMessage(event, requestId) {
  event.preventDefault();

  const textarea = event.target.querySelector('textarea');
  const message = textarea.value.trim();

  if (!message) return;

  const request = agencyRequests.find(r => r.requestId === requestId);

  try {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        requestType: 'agency',
        sender: 'admin',
        senderName: '管理者',
        message
      })
    });

    const data = await response.json();

    if (response.ok) {
      textarea.value = '';

      // メッセージ再読み込み
      const messagesResponse = await fetch(`/api/messages/${requestId}`);
      const messages = await messagesResponse.json();
      showMessageDetail(requestId, request, messages);

      showMessage('メッセージを送信しました', 'success');
    } else {
      showMessage(data.error || '送信に失敗しました', 'error');
    }
  } catch (error) {
    console.error('メッセージ送信エラー:', error);
    showMessage('送信に失敗しました', 'error');
  }
}

// バックアップ
async function loadBackups() {
  try {
    const response = await fetch('/api/backups');
    const backups = await response.json();

    const tbody = document.getElementById('backupTableBody');
    tbody.innerHTML = '';

    if (backups.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" class="text-center">バックアップがありません</td></tr>';
      return;
    }

    backups.forEach(backup => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${formatDate(backup.date)}</td>
        <td>${(backup.size / 1024).toFixed(2)} KB</td>
      `;
      tbody.appendChild(row);
    });

  } catch (error) {
    console.error('バックアップ読み込みエラー:', error);
  }
}

async function createBackup() {
  try {
    const response = await fetch('/api/backup', {
      method: 'POST'
    });

    const data = await response.json();

    if (response.ok) {
      showMessage('バックアップを作成しました', 'success');
      loadBackups();
    } else {
      showMessage(data.error || 'バックアップに失敗しました', 'error');
    }
  } catch (error) {
    console.error('バックアップエラー:', error);
    showMessage('バックアップに失敗しました', 'error');
  }
}

// ユーティリティ
function formatDate(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function getStatusText(status) {
  const texts = {
    pending: '受付中',
    in_progress: '作業中',
    completed: '完了',
    cancelled: 'キャンセル'
  };
  return texts[status] || status;
}

function showMessage(message, type) {
  const messageBox = document.getElementById('messageBox');
  messageBox.textContent = message;
  messageBox.className = `message-box ${type} show`;

  setTimeout(() => {
    messageBox.classList.remove('show');
  }, 3000);
}
