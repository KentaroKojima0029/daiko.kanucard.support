/**
 * APIクライアント基底クラス
 * HTTP通信の基本機能とJWTトークン管理、エラーハンドリングを提供
 */

class ApiClient {
  constructor() {
    this.baseURL = API_CONFIG.baseURL;
    this.timeout = API_CONFIG.timeout;
    this.tokenKey = API_CONFIG.tokenKey;
    this.refreshTokenKey = API_CONFIG.refreshTokenKey;
    this.userKey = API_CONFIG.userKey;
    this.abortControllers = new Map();
  }

  /**
   * JWTトークンを取得
   */
  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * リフレッシュトークンを取得
   */
  getRefreshToken() {
    return localStorage.getItem(this.refreshTokenKey);
  }

  /**
   * トークンを保存
   */
  setToken(token, refreshToken = null) {
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    }
    if (refreshToken) {
      localStorage.setItem(this.refreshTokenKey, refreshToken);
    }
  }

  /**
   * トークンを削除
   */
  removeToken() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
  }

  /**
   * ユーザー情報を取得
   */
  getUser() {
    const userStr = localStorage.getItem(this.userKey);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * ユーザー情報を保存
   */
  setUser(user) {
    if (user) {
      localStorage.setItem(this.userKey, JSON.stringify(user));
    }
  }

  /**
   * URLにパラメータを追加
   */
  buildUrl(endpoint, params = {}) {
    let url = `${this.baseURL}${endpoint}`;

    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });

    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return url;
  }

  /**
   * リクエストヘッダーを構築
   */
  buildHeaders(customHeaders = {}) {
    const headers = {
      ...API_CONFIG.defaultHeaders,
      ...customHeaders
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * エラーレスポンスを処理
   */
  async handleErrorResponse(response, responseText) {
    let errorData = {
      success: false,
      message: ERROR_MESSAGES[ERROR_CODES.SERVER_ERROR],
      code: ERROR_CODES.SERVER_ERROR,
      status: response.status
    };

    try {
      const data = JSON.parse(responseText);
      errorData = {
        ...errorData,
        ...data,
        message: data.message || errorData.message
      };
    } catch (e) {
      // JSONパースエラーは無視
    }

    // ステータスコードに基づくエラーコード設定
    switch (response.status) {
      case 400:
        errorData.code = ERROR_CODES.BAD_REQUEST;
        break;
      case 401:
        errorData.code = ERROR_CODES.UNAUTHORIZED;
        // トークン期限切れの場合
        if (errorData.message && errorData.message.includes('expired')) {
          errorData.code = ERROR_CODES.TOKEN_EXPIRED;
          // トークンを削除して再ログインを促す
          this.removeToken();
          setTimeout(() => {
            window.location.href = '/login.html';
          }, 2000);
        }
        break;
      case 403:
        errorData.code = ERROR_CODES.FORBIDDEN;
        break;
      case 404:
        errorData.code = ERROR_CODES.NOT_FOUND;
        break;
      case 422:
        errorData.code = ERROR_CODES.VALIDATION_ERROR;
        break;
      case 500:
      case 502:
      case 503:
        errorData.code = ERROR_CODES.SERVER_ERROR;
        break;
      default:
        break;
    }

    return errorData;
  }

  /**
   * APIリクエストを実行
   */
  async request(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      params = {},
      headers: customHeaders = {},
      retry = true,
      showError = true
    } = options;

    const url = this.buildUrl(endpoint, params);
    const headers = this.buildHeaders(customHeaders);

    // タイムアウトの設定
    const abortController = new AbortController();
    const requestId = `${method}_${endpoint}_${Date.now()}`;
    this.abortControllers.set(requestId, abortController);

    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.timeout);

    const fetchOptions = {
      method,
      headers,
      signal: abortController.signal
    };

    // リクエストボディの設定
    if (body) {
      if (body instanceof FormData) {
        fetchOptions.body = body;
        delete fetchOptions.headers['Content-Type']; // FormDataの場合、ブラウザが自動設定
      } else if (typeof body === 'object') {
        fetchOptions.body = JSON.stringify(body);
      } else {
        fetchOptions.body = body;
      }
    }

    try {
      console.log(`[API Request] ${method} ${endpoint}`, { params, body });

      const response = await fetch(url, fetchOptions);
      const responseText = await response.text();

      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);

      // レスポンスのパース
      let data = null;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        // JSONでない場合はテキストとして扱う
        data = responseText;
      }

      // エラーレスポンスの処理
      if (!response.ok) {
        const errorData = await this.handleErrorResponse(response, responseText);

        if (showError) {
          console.error(`[API Error] ${method} ${endpoint}`, errorData);
        }

        throw errorData;
      }

      console.log(`[API Response] ${method} ${endpoint}`, data);

      // 成功レスポンス
      return {
        success: true,
        data: data.data || data,
        message: data.message || 'Success'
      };

    } catch (error) {
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);

      // AbortErrorの処理
      if (error.name === 'AbortError') {
        const timeoutError = {
          success: false,
          message: ERROR_MESSAGES[ERROR_CODES.TIMEOUT],
          code: ERROR_CODES.TIMEOUT
        };
        if (showError) {
          console.error(`[API Timeout] ${method} ${endpoint}`, timeoutError);
        }
        throw timeoutError;
      }

      // ネットワークエラーの処理
      if (error.message === 'Failed to fetch' || !navigator.onLine) {
        const networkError = {
          success: false,
          message: ERROR_MESSAGES[ERROR_CODES.NETWORK_ERROR],
          code: ERROR_CODES.NETWORK_ERROR
        };
        if (showError) {
          console.error(`[API Network Error] ${method} ${endpoint}`, networkError);
        }
        throw networkError;
      }

      // その他のエラー
      throw error;
    }
  }

  /**
   * リクエストをキャンセル
   */
  cancelRequest(requestId) {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  /**
   * すべてのリクエストをキャンセル
   */
  cancelAllRequests() {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
  }

  /**
   * GETリクエスト
   */
  async get(endpoint, params = {}, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'GET',
      params
    });
  }

  /**
   * POSTリクエスト
   */
  async post(endpoint, body = null, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body
    });
  }

  /**
   * PUTリクエスト
   */
  async put(endpoint, body = null, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body
    });
  }

  /**
   * PATCHリクエスト
   */
  async patch(endpoint, body = null, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body
    });
  }

  /**
   * DELETEリクエスト
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'DELETE'
    });
  }

  /**
   * ファイルアップロード
   */
  async upload(endpoint, file, additionalData = {}) {
    const formData = new FormData();
    formData.append('file', file);

    // 追加データをFormDataに追加
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });

    return this.post(endpoint, formData);
  }

  /**
   * CSVダウンロード
   */
  async downloadCSV(endpoint, params = {}, filename = 'export.csv') {
    const url = this.buildUrl(endpoint, params);
    const headers = this.buildHeaders({
      'Accept': 'text/csv'
    });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(downloadUrl);

      return {
        success: true,
        message: 'ダウンロードが完了しました'
      };
    } catch (error) {
      console.error('CSV Download Error:', error);
      throw {
        success: false,
        message: 'ダウンロードに失敗しました'
      };
    }
  }
}

// グローバルインスタンスの作成
const apiClient = new ApiClient();