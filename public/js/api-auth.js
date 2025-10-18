/**
 * 認証API
 * ユーザー認証、ログイン、ログアウト、権限管理機能を提供
 */

const authAPI = {
  /**
   * 管理者ログイン
   * @param {string} email - メールアドレス
   * @param {string} password - パスワード
   * @returns {Promise<Object>} ユーザー情報
   */
  async login(email, password) {
    try {
      // 入力値の検証
      if (!email || !password) {
        throw {
          success: false,
          message: 'メールアドレスとパスワードを入力してください',
          code: ERROR_CODES.VALIDATION_ERROR
        };
      }

      // メールアドレスの形式チェック
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw {
          success: false,
          message: 'メールアドレスの形式が正しくありません',
          code: ERROR_CODES.VALIDATION_ERROR
        };
      }

      const response = await apiClient.post(API_ENDPOINTS.auth.login, {
        email,
        password
      });

      // ログイン成功時、トークンとユーザー情報を保存
      if (response.success && response.data) {
        const { token, refreshToken, user } = response.data;
        if (token) {
          apiClient.setToken(token, refreshToken);
        }
        if (user) {
          apiClient.setUser(user);
        }
        return user;
      }

      throw {
        success: false,
        message: response.message || 'ログインに失敗しました'
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  /**
   * ログアウト
   */
  async logout() {
    try {
      // サーバー側のログアウト処理を呼び出し
      try {
        await apiClient.post(API_ENDPOINTS.auth.logout);
      } catch (error) {
        // エラーが発生してもログアウト処理は続行
        console.warn('Server logout failed:', error);
      }

      // ローカルのトークンとユーザー情報を削除
      apiClient.removeToken();

      // すべてのリクエストをキャンセル
      apiClient.cancelAllRequests();

      // ログインページへリダイレクト
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 100);

      return {
        success: true,
        message: 'ログアウトしました'
      };
    } catch (error) {
      // エラーが発生してもローカルのトークンは削除
      apiClient.removeToken();
      apiClient.cancelAllRequests();

      return {
        success: true,
        message: 'ログアウトしました'
      };
    }
  },

  /**
   * ログイン状態を確認
   * @returns {boolean} ログイン済みかどうか
   */
  isAuthenticated() {
    return !!apiClient.getToken();
  },

  /**
   * 管理者権限を確認
   * @returns {Promise<boolean>} 管理者権限があるかどうか
   */
  async isAdmin() {
    try {
      // ローカルのユーザー情報から確認
      const user = apiClient.getUser();
      if (!user) {
        return false;
      }

      // 管理者権限の確認（ローカル情報のみ使用）
      // サーバー確認を無効化して無限ループを防ぐ
      return user.role === 'admin';
    } catch (error) {
      console.error('Admin check error:', error);
      return false;
    }
  },

  /**
   * 現在のユーザー情報を取得
   * @param {boolean} forceRefresh - 強制的にサーバーから取得するか
   * @returns {Promise<Object>} ユーザー情報
   */
  async getCurrentUser(forceRefresh = false) {
    try {
      // キャッシュからユーザー情報を取得
      if (!forceRefresh) {
        const cachedUser = apiClient.getUser();
        if (cachedUser) {
          return cachedUser;
        }
      }

      // トークンがない場合はエラー
      if (!apiClient.getToken()) {
        throw {
          success: false,
          message: 'ログインが必要です',
          code: ERROR_CODES.UNAUTHORIZED
        };
      }

      // サーバーから最新のユーザー情報を取得
      const response = await apiClient.get(API_ENDPOINTS.auth.me);

      if (response.success && response.data) {
        apiClient.setUser(response.data);
        return response.data;
      }

      throw {
        success: false,
        message: 'ユーザー情報の取得に失敗しました'
      };
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  },

  /**
   * トークンをリフレッシュ
   * @returns {Promise<Object>} 新しいトークン
   */
  async refreshToken() {
    try {
      const refreshToken = apiClient.getRefreshToken();
      if (!refreshToken) {
        throw {
          success: false,
          message: 'リフレッシュトークンがありません',
          code: ERROR_CODES.UNAUTHORIZED
        };
      }

      const response = await apiClient.post(API_ENDPOINTS.auth.refresh, {
        refreshToken
      });

      // 新しいトークンを保存
      if (response.success && response.data) {
        const { token, refreshToken: newRefreshToken } = response.data;
        apiClient.setToken(token, newRefreshToken || refreshToken);
        return response.data;
      }

      throw {
        success: false,
        message: 'トークンのリフレッシュに失敗しました'
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      // リフレッシュに失敗した場合はログアウト
      apiClient.removeToken();
      throw error;
    }
  },

  /**
   * 認証チェックとリダイレクト
   * ページ読み込み時に実行
   */
  async checkAuth() {
    // ログインページの場合はチェックしない
    if (window.location.pathname.includes('login')) {
      return true;
    }

    // トークンの存在確認
    if (!this.isAuthenticated()) {
      console.warn('Not authenticated, redirecting to login...');
      window.location.href = '/login.html';
      return false;
    }

    // 管理者権限の確認（管理者ページの場合）
    if (window.location.pathname.includes('admin')) {
      try {
        const isAdmin = await this.isAdmin();
        if (!isAdmin) {
          console.warn('Admin permission required');
          // logout()を呼ぶと無限ループになるため、トークンを削除してリダイレクト
          apiClient.removeToken();
          window.location.href = '/login.html';
          return false;
        }
      } catch (error) {
        console.error('Admin check failed:', error);
        // logout()を呼ぶと無限ループになるため、トークンを削除してリダイレクト
        this.removeToken();
        window.location.href = '/login.html';
        return false;
      }
    }

    return true;
  },

  /**
   * 自動ログアウトタイマーの設定
   * @param {number} timeout - タイムアウト時間（ミリ秒）
   */
  setupAutoLogout(timeout = 30 * 60 * 1000) { // デフォルト30分
    let logoutTimer = null;

    const resetTimer = () => {
      if (logoutTimer) {
        clearTimeout(logoutTimer);
      }
      logoutTimer = setTimeout(() => {
        alert('セッションがタイムアウトしました。再度ログインしてください。');
        this.logout();
      }, timeout);
    };

    // ユーザーアクティビティの監視
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });

    // 初回タイマー設定
    resetTimer();
  },

  /**
   * セッション管理の初期化
   */
  initSession() {
    // 認証チェック
    this.checkAuth().then(authenticated => {
      if (authenticated) {
        // 自動ログアウトタイマーの設定
        this.setupAutoLogout();

        // トークン自動リフレッシュの設定（5分ごと）
        setInterval(async () => {
          if (this.isAuthenticated()) {
            try {
              await this.refreshToken();
              console.log('Token refreshed successfully');
            } catch (error) {
              console.error('Token refresh failed:', error);
            }
          }
        }, 5 * 60 * 1000);
      }
    });
  }
};

// ページ読み込み時にセッション管理を初期化
// 注意: admin.html 側で独自の初期化ロジックがあるため、自動初期化を無効化
// if (typeof document !== 'undefined') {
//   document.addEventListener('DOMContentLoaded', () => {
//     // 管理者ページまたは認証が必要なページの場合
//     if (window.location.pathname.includes('admin') ||
//         window.location.pathname.includes('dashboard')) {
//       authAPI.initSession();
//     }
//   });
// }