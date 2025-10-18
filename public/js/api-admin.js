/**
 * 管理者API
 * 管理者専用のダッシュボード機能と申請管理機能を提供
 */

const adminAPI = {
  /**
   * ダッシュボード統計情報を取得
   * @returns {Promise<Object>} ダッシュボード統計データ
   */
  async getDashboard() {
    try {
      const response = await apiClient.get(API_ENDPOINTS.admin.dashboard);

      if (response.success && response.data) {
        // データの整形
        const dashboardData = {
          // 申請統計
          totalForms: response.data.totalForms || 0,
          pendingForms: response.data.pendingForms || 0,
          processingForms: response.data.processingForms || 0,
          completedForms: response.data.completedForms || 0,
          cancelledForms: response.data.cancelledForms || 0,

          // 今月の統計
          monthlyStats: {
            newForms: response.data.monthlyNewForms || 0,
            completedForms: response.data.monthlyCompletedForms || 0,
            revenue: response.data.monthlyRevenue || 0,
            growthRate: response.data.monthlyGrowthRate || 0
          },

          // 最近の申請
          recentForms: response.data.recentForms || [],

          // 顧客統計
          totalCustomers: response.data.totalCustomers || 0,
          activeCustomers: response.data.activeCustomers || 0,
          newCustomersThisMonth: response.data.newCustomersThisMonth || 0,

          // パフォーマンス指標
          averageProcessingTime: response.data.averageProcessingTime || 0,
          customerSatisfactionRate: response.data.customerSatisfactionRate || 0
        };

        return dashboardData;
      }

      return response.data;
    } catch (error) {
      console.error('Get dashboard error:', error);
      throw error;
    }
  },

  /**
   * 全申請一覧を取得
   * @param {Object} filters - フィルターオプション
   * @returns {Promise<Object>} 申請一覧
   */
  async getForms(filters = {}) {
    try {
      const params = {
        status: filters.status,
        page: filters.page || 1,
        limit: filters.limit || 20,
        search: filters.search,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        customerId: filters.customerId,
        sortBy: filters.sortBy || 'createdAt',
        sortOrder: filters.sortOrder || 'desc'
      };

      const response = await apiClient.get(API_ENDPOINTS.admin.forms, params);
      return response.data;
    } catch (error) {
      console.error('Get forms error:', error);
      throw error;
    }
  },

  /**
   * 申請詳細を取得
   * @param {string} id - 申請ID
   * @returns {Promise<Object>} 申請詳細情報
   */
  async getFormById(id) {
    try {
      if (!id) {
        throw {
          success: false,
          message: '申請IDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR
        };
      }

      const endpoint = `${API_ENDPOINTS.forms.detail}/${id}`;
      const response = await apiClient.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('Get form detail error:', error);
      throw error;
    }
  },

  /**
   * 申請ステータスを更新
   * @param {string} id - 申請ID
   * @param {string} status - 新しいステータス
   * @param {string} note - メモ（任意）
   * @returns {Promise<Object>} 更新結果
   */
  async updateFormStatus(id, status, note = '') {
    try {
      if (!id || !status) {
        throw {
          success: false,
          message: '申請IDとステータスを指定してください',
          code: ERROR_CODES.VALIDATION_ERROR
        };
      }

      // 有効なステータスかチェック
      const validStatuses = Object.values(FORM_STATUS);
      if (!validStatuses.includes(status)) {
        throw {
          success: false,
          message: '無効なステータスです',
          code: ERROR_CODES.VALIDATION_ERROR
        };
      }

      const endpoint = `${API_ENDPOINTS.forms.update}/${id}/status`;
      const updateData = {
        status,
        note,
        updatedAt: new Date().toISOString()
      };

      const response = await apiClient.put(endpoint, updateData);
      return response.data;
    } catch (error) {
      console.error('Update form status error:', error);
      throw error;
    }
  },

  /**
   * 申請情報を更新
   * @param {string} id - 申請ID
   * @param {Object} data - 更新データ
   * @returns {Promise<Object>} 更新結果
   */
  async updateForm(id, data) {
    try {
      if (!id) {
        throw {
          success: false,
          message: '申請IDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR
        };
      }

      const endpoint = `${API_ENDPOINTS.forms.update}/${id}`;
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString()
      };

      const response = await apiClient.put(endpoint, updateData);
      return response.data;
    } catch (error) {
      console.error('Update form error:', error);
      throw error;
    }
  },

  /**
   * 申請を削除
   * @param {string} id - 申請ID
   * @returns {Promise<Object>} 削除結果
   */
  async deleteForm(id) {
    try {
      if (!id) {
        throw {
          success: false,
          message: '申請IDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR
        };
      }

      const endpoint = `${API_ENDPOINTS.forms.delete}/${id}`;
      const response = await apiClient.delete(endpoint);
      return response;
    } catch (error) {
      console.error('Delete form error:', error);
      throw error;
    }
  },

  /**
   * 申請にメモを追加
   * @param {string} formId - 申請ID
   * @param {string} note - メモ内容
   * @param {string} type - メモタイプ
   * @returns {Promise<Object>} 追加結果
   */
  async addNote(formId, note, type = 'general') {
    try {
      if (!formId || !note) {
        throw {
          success: false,
          message: '申請IDとメモ内容を入力してください',
          code: ERROR_CODES.VALIDATION_ERROR
        };
      }

      const endpoint = `${API_ENDPOINTS.forms.notes}/${formId}/notes`;
      const noteData = {
        content: note,
        type,
        createdAt: new Date().toISOString()
      };

      const response = await apiClient.post(endpoint, noteData);
      return response.data;
    } catch (error) {
      console.error('Add note error:', error);
      throw error;
    }
  },

  /**
   * 顧客一覧を取得
   * @param {Object} options - フィルターオプション
   * @returns {Promise<Object>} 顧客一覧
   */
  async getCustomers(options = {}) {
    try {
      const params = {
        page: options.page || 1,
        limit: options.limit || 20,
        search: options.search,
        sortBy: options.sortBy || 'createdAt',
        sortOrder: options.sortOrder || 'desc'
      };

      const response = await apiClient.get(API_ENDPOINTS.admin.customers, params);
      return response.data;
    } catch (error) {
      console.error('Get customers error:', error);
      throw error;
    }
  },

  /**
   * 顧客詳細情報を取得
   * @param {string} customerId - 顧客ID
   * @returns {Promise<Object>} 顧客詳細情報
   */
  async getCustomerDetail(customerId) {
    try {
      if (!customerId) {
        throw {
          success: false,
          message: '顧客IDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR
        };
      }

      const endpoint = `${API_ENDPOINTS.customers.detail}/${customerId}`;
      const response = await apiClient.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('Get customer detail error:', error);
      throw error;
    }
  },

  /**
   * 顧客別の申請一覧を取得
   * @param {string} customerId - 顧客ID
   * @param {Object} options - オプション
   * @returns {Promise<Object>} 申請一覧
   */
  async getCustomerForms(customerId, options = {}) {
    try {
      if (!customerId) {
        throw {
          success: false,
          message: '顧客IDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR
        };
      }

      const endpoint = `${API_ENDPOINTS.customers.forms}/${customerId}/forms`;
      const params = {
        page: options.page || 1,
        limit: options.limit || 10,
        status: options.status,
        sortBy: options.sortBy || 'createdAt',
        sortOrder: options.sortOrder || 'desc'
      };

      const response = await apiClient.get(endpoint, params);
      return response.data;
    } catch (error) {
      console.error('Get customer forms error:', error);
      throw error;
    }
  },

  /**
   * CSVエクスポート
   * @param {Object} filters - エクスポートフィルター
   * @returns {Promise<Object>} エクスポート結果
   */
  async exportForms(filters = {}) {
    try {
      const params = {
        format: 'csv',
        status: filters.status,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        customerId: filters.customerId
      };

      // ファイル名の生成
      const now = new Date();
      const fileName = `forms_export_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.csv`;

      // CSVダウンロード
      const result = await apiClient.downloadCSV(API_ENDPOINTS.admin.export, params, fileName);
      return result;
    } catch (error) {
      console.error('Export forms error:', error);
      throw error;
    }
  },

  /**
   * メッセージを送信（管理者から顧客へ）
   * @param {Object} messageData - メッセージデータ
   * @returns {Promise<Object>} 送信結果
   */
  async sendMessage(messageData) {
    try {
      if (!messageData.formId || !messageData.content) {
        throw {
          success: false,
          message: '申請IDとメッセージ内容を入力してください',
          code: ERROR_CODES.VALIDATION_ERROR
        };
      }

      const data = {
        formId: messageData.formId,
        content: messageData.content,
        fromAdmin: true
      };

      const response = await apiClient.post(API_ENDPOINTS.messages.send, data);
      return response.data;
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  },

  /**
   * システム設定を取得
   * @returns {Promise<Object>} システム設定
   */
  async getSystemSettings() {
    try {
      const response = await apiClient.get(API_ENDPOINTS.admin.settings);
      return response.data;
    } catch (error) {
      console.error('Get system settings error:', error);
      throw error;
    }
  },

  /**
   * システム設定を更新
   * @param {Object} settings - 更新する設定
   * @returns {Promise<Object>} 更新結果
   */
  async updateSystemSettings(settings) {
    try {
      const response = await apiClient.put(API_ENDPOINTS.admin.settings, settings);
      return response.data;
    } catch (error) {
      console.error('Update system settings error:', error);
      throw error;
    }
  },

  /**
   * 統計レポートを生成
   * @param {Object} options - レポートオプション
   * @returns {Promise<Object>} レポートデータ
   */
  async generateReport(options = {}) {
    try {
      const params = {
        type: options.type || 'monthly',
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        includeDetails: options.includeDetails !== false
      };

      const response = await apiClient.get(API_ENDPOINTS.admin.reports, params);
      return response.data;
    } catch (error) {
      console.error('Generate report error:', error);
      throw error;
    }
  },

  /**
   * ダッシュボードをHTMLに表示
   * @param {Object} dashboard - ダッシュボードデータ
   */
  renderDashboard(dashboard) {
    // 統計カードの更新
    const updateStatCard = (id, value) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    };

    updateStatCard('totalForms', dashboard.totalForms);
    updateStatCard('pendingForms', dashboard.pendingForms);
    updateStatCard('processingForms', dashboard.processingForms);
    updateStatCard('completedForms', dashboard.completedForms);

    // 月次統計の更新
    if (dashboard.monthlyStats) {
      updateStatCard('monthlyNewForms', dashboard.monthlyStats.newForms);
      updateStatCard('monthlyRevenue', API_UTILS.formatCurrency(dashboard.monthlyStats.revenue));
      updateStatCard('monthlyGrowthRate', `${dashboard.monthlyStats.growthRate}%`);
    }

    // 最近の申請リストの更新
    const recentFormsElement = document.getElementById('recentFormsList');
    if (recentFormsElement && dashboard.recentForms) {
      recentFormsElement.innerHTML = dashboard.recentForms.map(form => `
        <div class="recent-form-item">
          <span class="date">${API_UTILS.formatDateTime(form.timestamp, false)}</span>
          <span class="customer">${form.customer?.name || '不明'}</span>
          ${API_UTILS.getStatusBadge(form.status)}
          <button onclick="viewFormDetail('${form.id}')" class="btn-view">詳細</button>
        </div>
      `).join('');
    }
  }
};