/**
 * API設定ファイル
 * PSA鑑定代行APIサーバーへの接続設定と定数定義
 */

// API基本設定
const API_CONFIG = {
  // APIエンドポイント
  baseURL: 'https://api.kanucard.com',

  // タイムアウト時間（30秒）
  timeout: 30000,

  // ローカルストレージのキー
  tokenKey: 'kanucard_admin_token',
  refreshTokenKey: 'kanucard_refresh_token',
  userKey: 'kanucard_user_data',

  // デフォルトヘッダー
  defaultHeaders: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

// APIエンドポイント定義
const API_ENDPOINTS = {
  // 認証関連
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    refresh: '/api/auth/refresh'
  },

  // 管理者API
  admin: {
    dashboard: '/api/admin/dashboard',
    forms: '/api/admin/forms',
    customers: '/api/admin/customers',
    export: '/api/admin/forms/export',
    settings: '/api/admin/settings',
    reports: '/api/admin/reports'
  },

  // 申請管理
  forms: {
    detail: '/api/admin/forms',
    update: '/api/admin/forms',
    delete: '/api/admin/forms',
    notes: '/api/admin/forms',
    status: '/api/admin/forms'
  },

  // 顧客管理
  customers: {
    list: '/api/admin/customers',
    detail: '/api/admin/customers',
    forms: '/api/admin/customers'
  },

  // メッセージ
  messages: {
    send: '/api/admin/messages',
    list: '/api/admin/messages'
  }
};

// フォームステータス定義
const FORM_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  GRADING: 'grading',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected'
};

// フォームステータスの日本語ラベル
const FORM_STATUS_LABELS = {
  pending: '申請済み',
  processing: '処理中',
  shipped: '発送済み',
  grading: '鑑定中',
  completed: '完了',
  cancelled: 'キャンセル済み',
  rejected: '却下'
};

// フォームステータスの色
const FORM_STATUS_COLORS = {
  pending: '#007bff',    // 青
  processing: '#17a2b8', // シアン
  shipped: '#fd7e14',    // オレンジ
  grading: '#ffc107',    // イエロー
  completed: '#28a745',  // 緑
  cancelled: '#6c757d',  // グレー
  rejected: '#dc3545'    // 赤
};

// エラーコード定義
const ERROR_CODES = {
  // ネットワークエラー
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',

  // 認証エラー
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // リクエストエラー
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // サーバーエラー
  SERVER_ERROR: 'SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
};

// エラーメッセージ定義
const ERROR_MESSAGES = {
  [ERROR_CODES.NETWORK_ERROR]: 'ネットワークエラーが発生しました。インターネット接続を確認してください。',
  [ERROR_CODES.TIMEOUT]: 'リクエストがタイムアウトしました。もう一度お試しください。',
  [ERROR_CODES.UNAUTHORIZED]: 'ログインが必要です。',
  [ERROR_CODES.FORBIDDEN]: 'このリソースへのアクセス権限がありません。',
  [ERROR_CODES.TOKEN_EXPIRED]: 'セッションの有効期限が切れました。再度ログインしてください。',
  [ERROR_CODES.INVALID_CREDENTIALS]: 'メールアドレスまたはパスワードが正しくありません。',
  [ERROR_CODES.BAD_REQUEST]: 'リクエストが不正です。',
  [ERROR_CODES.NOT_FOUND]: '要求されたリソースが見つかりません。',
  [ERROR_CODES.VALIDATION_ERROR]: '入力内容に誤りがあります。',
  [ERROR_CODES.SERVER_ERROR]: 'サーバーエラーが発生しました。しばらくしてからもう一度お試しください。',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'サービスが一時的に利用できません。'
};

// ユーティリティ関数
const API_UTILS = {
  // 日時を日本語形式にフォーマット
  formatDateTime: function(date, includeTime = true) {
    if (!date) return '';

    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    if (!includeTime) {
      return `${year}年${month}月${day}日`;
    }

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${year}年${month}月${day}日 ${hours}:${minutes}`;
  },

  // 金額を日本円形式にフォーマット
  formatCurrency: function(amount) {
    if (amount === null || amount === undefined) return '¥0';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount);
  },

  // ステータスバッジのHTML生成
  getStatusBadge: function(status) {
    const label = FORM_STATUS_LABELS[status] || status;
    const color = FORM_STATUS_COLORS[status] || '#6c757d';

    return `<span class="badge" style="background-color: ${color}; color: white; padding: 4px 8px; border-radius: 4px;">${label}</span>`;
  },

  // エラーメッセージを取得
  getErrorMessage: function(error) {
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.code && ERROR_MESSAGES[error.code]) {
      return ERROR_MESSAGES[error.code];
    }
    return 'エラーが発生しました。もう一度お試しください。';
  }
};