/**
 * フォーム管理API
 * 申請フォームの詳細管理とUI連携機能を提供
 */

const formsAPI = {
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
   * ステータスを更新
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

      const endpoint = `${API_ENDPOINTS.forms.update}/${id}`;
      const updateData = {
        status,
        statusNote: note,
        statusUpdatedAt: new Date().toISOString()
      };

      const response = await apiClient.patch(endpoint, updateData);
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
   * メモを追加
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
   * 申請の履歴を取得
   * @param {string} formId - 申請ID
   * @returns {Promise<Object>} 履歴データ
   */
  async getFormHistory(formId) {
    try {
      if (!formId) {
        throw {
          success: false,
          message: '申請IDが指定されていません',
          code: ERROR_CODES.VALIDATION_ERROR
        };
      }

      const endpoint = `${API_ENDPOINTS.forms.detail}/${formId}/history`;
      const response = await apiClient.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('Get form history error:', error);
      throw error;
    }
  },

  /**
   * 申請テーブルをHTMLに表示
   * @param {Array} forms - 申請データ配列
   * @param {string} tableId - テーブル要素のID
   */
  renderFormsTable(forms, tableId = 'formsTableBody') {
    const tbody = document.getElementById(tableId);
    if (!tbody) {
      console.error(`Table body element not found: ${tableId}`);
      return;
    }

    // テーブルをクリア
    tbody.innerHTML = '';

    // データがない場合
    if (!forms || forms.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">データがありません</td></tr>';
      return;
    }

    // 各申請をテーブル行として追加
    forms.forEach(form => {
      const row = tbody.insertRow();
      row.innerHTML = `
        <td>${form.id || '-'}</td>
        <td>${API_UTILS.formatDateTime(form.timestamp)}</td>
        <td>${form.customer?.name || '不明'}</td>
        <td>${form.customer?.email || '-'}</td>
        <td>${form.totalCards || 0}枚</td>
        <td>${API_UTILS.getStatusBadge(form.status)}</td>
        <td>
          <button onclick="formsAPI.viewFormDetail('${form.id}')" class="btn btn-sm btn-info">詳細</button>
          <button onclick="formsAPI.showStatusUpdateDialog('${form.id}', '${form.status}')" class="btn btn-sm btn-warning">ステータス変更</button>
        </td>
      `;
    });
  },

  /**
   * 申請詳細をモーダルで表示
   * @param {string} formId - 申請ID
   */
  async viewFormDetail(formId) {
    try {
      // 申請詳細を取得
      const form = await this.getFormById(formId);

      // モーダルコンテンツを生成
      const modalContent = `
        <div class="form-detail">
          <h3>申請詳細 #${form.id}</h3>

          <div class="section">
            <h4>顧客情報</h4>
            <dl>
              <dt>お名前:</dt><dd>${form.customer?.name || '-'}</dd>
              <dt>メール:</dt><dd>${form.customer?.email || '-'}</dd>
              <dt>電話番号:</dt><dd>${form.customer?.phone || '-'}</dd>
              <dt>会社名:</dt><dd>${form.customer?.company || '-'}</dd>
            </dl>
          </div>

          <div class="section">
            <h4>サービス情報</h4>
            <dl>
              <dt>PSAプラン:</dt><dd>${form.service?.psaPlan || '-'}</dd>
              <dt>代行プラン:</dt><dd>${form.service?.agentPlan || '-'}</dd>
              <dt>買取オファー:</dt><dd>${form.service?.purchaseOffer ? 'あり' : 'なし'}</dd>
              <dt>返却方法:</dt><dd>${form.service?.returnMethod || '-'}</dd>
            </dl>
          </div>

          <div class="section">
            <h4>カード情報</h4>
            <table class="table">
              <thead>
                <tr>
                  <th>カード名</th>
                  <th>枚数</th>
                  <th>申告価格</th>
                  <th>備考</th>
                </tr>
              </thead>
              <tbody>
                ${form.cards?.map(card => `
                  <tr>
                    <td>${card.cardName || '-'}</td>
                    <td>${card.quantity || 0}</td>
                    <td>${API_UTILS.formatCurrency(card.declaredValue || 0)}</td>
                    <td>${card.notes || '-'}</td>
                  </tr>
                `).join('') || '<tr><td colspan="4">カード情報なし</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h4>ステータス</h4>
            <p>現在のステータス: ${API_UTILS.getStatusBadge(form.status)}</p>
            <p>申請日時: ${API_UTILS.formatDateTime(form.timestamp)}</p>
            <p>更新日時: ${API_UTILS.formatDateTime(form.updatedAt)}</p>
          </div>
        </div>
      `;

      // モーダルを表示
      this.showModal('申請詳細', modalContent);
    } catch (error) {
      alert('申請詳細の取得に失敗しました: ' + API_UTILS.getErrorMessage(error));
    }
  },

  /**
   * ステータス更新ダイアログを表示
   * @param {string} formId - 申請ID
   * @param {string} currentStatus - 現在のステータス
   */
  showStatusUpdateDialog(formId, currentStatus) {
    const dialogContent = `
      <div class="status-update-dialog">
        <h4>ステータス更新</h4>
        <p>申請ID: ${formId}</p>
        <p>現在のステータス: ${API_UTILS.getStatusBadge(currentStatus)}</p>

        <form id="statusUpdateForm">
          <div class="form-group">
            <label>新しいステータス:</label>
            <select id="newStatus" class="form-control" required>
              <option value="">選択してください</option>
              ${Object.entries(FORM_STATUS_LABELS).map(([value, label]) =>
                `<option value="${value}" ${value === currentStatus ? 'disabled' : ''}>${label}</option>`
              ).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>メモ（任意）:</label>
            <textarea id="statusNote" class="form-control" rows="3"></textarea>
          </div>

          <div class="form-buttons">
            <button type="submit" class="btn btn-primary">更新</button>
            <button type="button" onclick="formsAPI.closeModal()" class="btn btn-secondary">キャンセル</button>
          </div>
        </form>
      </div>
    `;

    this.showModal('ステータス更新', dialogContent);

    // フォーム送信イベント
    const form = document.getElementById('statusUpdateForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newStatus = document.getElementById('newStatus').value;
        const note = document.getElementById('statusNote').value;

        if (!newStatus) {
          alert('新しいステータスを選択してください');
          return;
        }

        try {
          await this.updateFormStatus(formId, newStatus, note);
          alert('ステータスを更新しました');
          this.closeModal();
          // テーブルを再読み込み
          if (typeof loadForms === 'function') {
            loadForms();
          }
        } catch (error) {
          alert('ステータスの更新に失敗しました: ' + API_UTILS.getErrorMessage(error));
        }
      });
    }
  },

  /**
   * モーダルを表示
   * @param {string} title - モーダルタイトル
   * @param {string} content - モーダルコンテンツ（HTML）
   */
  showModal(title, content) {
    // 既存のモーダルを削除
    this.closeModal();

    // モーダル要素を作成
    const modal = document.createElement('div');
    modal.id = 'formModal';
    modal.className = 'modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div class="modal-content" style="
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 800px;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
      ">
        <span class="modal-close" onclick="formsAPI.closeModal()" style="
          position: absolute;
          top: 10px;
          right: 15px;
          font-size: 28px;
          font-weight: bold;
          cursor: pointer;
        ">&times;</span>
        <h2>${title}</h2>
        <div class="modal-body">
          ${content}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  },

  /**
   * モーダルを閉じる
   */
  closeModal() {
    const modal = document.getElementById('formModal');
    if (modal) {
      modal.remove();
    }
  },

  /**
   * 一括操作（ステータス一括更新など）
   * @param {Array} formIds - 申請ID配列
   * @param {string} operation - 操作タイプ
   * @param {Object} data - 操作データ
   */
  async bulkOperation(formIds, operation, data = {}) {
    try {
      if (!formIds || formIds.length === 0) {
        throw {
          success: false,
          message: '申請が選択されていません',
          code: ERROR_CODES.VALIDATION_ERROR
        };
      }

      const endpoint = `/api/admin/forms/bulk/${operation}`;
      const response = await apiClient.post(endpoint, {
        formIds,
        ...data
      });

      return response.data;
    } catch (error) {
      console.error('Bulk operation error:', error);
      throw error;
    }
  }
};