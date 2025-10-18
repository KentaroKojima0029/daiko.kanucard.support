/**
 * Shopify API クライアント
 * Shopify決済連携機能を提供
 */

const shopifyAPI = {
    /**
     * 決済リンクを生成
     * @param {string} applicationId - 申請ID
     * @param {Object} paymentData - 決済データ
     * @returns {Promise<Object>} 決済リンク情報
     */
    async createPaymentLink(applicationId, paymentData) {
        try {
            if (!applicationId || !paymentData) {
                throw {
                    success: false,
                    message: '申請IDと決済データが必要です',
                    code: ERROR_CODES.VALIDATION_ERROR
                };
            }

            const endpoint = `/api/shopify/payment-link`;
            const requestData = {
                applicationId,
                ...paymentData
            };

            const response = await apiClient.post(endpoint, requestData);
            return response.data;
        } catch (error) {
            console.error('Create payment link error:', error);
            throw error;
        }
    },

    /**
     * 決済ステータスを確認
     * @param {string} checkoutId - チェックアウトID
     * @returns {Promise<Object>} 決済ステータス
     */
    async getPaymentStatus(checkoutId) {
        try {
            if (!checkoutId) {
                throw {
                    success: false,
                    message: 'チェックアウトIDが必要です',
                    code: ERROR_CODES.VALIDATION_ERROR
                };
            }

            const endpoint = `/api/shopify/payment-status/${checkoutId}`;
            const response = await apiClient.get(endpoint);
            return response.data;
        } catch (error) {
            console.error('Get payment status error:', error);
            throw error;
        }
    },

    /**
     * 請求書を作成
     * @param {string} applicationId - 申請ID
     * @param {Object} invoiceData - 請求データ
     * @returns {Promise<Object>} 請求書情報
     */
    async createInvoice(applicationId, invoiceData) {
        try {
            if (!applicationId || !invoiceData) {
                throw {
                    success: false,
                    message: '申請IDと請求データが必要です',
                    code: ERROR_CODES.VALIDATION_ERROR
                };
            }

            const endpoint = `/api/shopify/invoice`;
            const requestData = {
                applicationId,
                ...invoiceData
            };

            const response = await apiClient.post(endpoint, requestData);
            return response.data;
        } catch (error) {
            console.error('Create invoice error:', error);
            throw error;
        }
    },

    /**
     * Shopify顧客を作成または更新
     * @param {Object} customerData - 顧客データ
     * @returns {Promise<Object>} 顧客情報
     */
    async syncCustomer(customerData) {
        try {
            if (!customerData || !customerData.email) {
                throw {
                    success: false,
                    message: 'メールアドレスが必要です',
                    code: ERROR_CODES.VALIDATION_ERROR
                };
            }

            const endpoint = `/api/shopify/customer`;
            const response = await apiClient.post(endpoint, customerData);
            return response.data;
        } catch (error) {
            console.error('Sync customer error:', error);
            throw error;
        }
    },

    /**
     * 決済リンクを生成してメール送信
     * @param {string} applicationId - 申請ID
     * @param {Object} options - オプション
     * @returns {Promise<Object>} 送信結果
     */
    async sendPaymentEmail(applicationId, options = {}) {
        try {
            if (!applicationId) {
                throw {
                    success: false,
                    message: '申請IDが必要です',
                    code: ERROR_CODES.VALIDATION_ERROR
                };
            }

            const endpoint = `/api/shopify/send-payment-email`;
            const requestData = {
                applicationId,
                ...options
            };

            const response = await apiClient.post(endpoint, requestData);
            return response.data;
        } catch (error) {
            console.error('Send payment email error:', error);
            throw error;
        }
    },

    /**
     * Shopify統合ステータスを確認
     * @returns {Promise<Object>} 統合ステータス
     */
    async getIntegrationStatus() {
        try {
            const endpoint = `/api/shopify/status`;
            const response = await apiClient.get(endpoint);
            return response.data;
        } catch (error) {
            console.error('Get integration status error:', error);
            throw error;
        }
    },

    /**
     * 決済ボタンを生成（HTMLヘルパー）
     * @param {Object} options - ボタンオプション
     * @returns {string} HTML文字列
     */
    generatePaymentButton(options = {}) {
        const {
            applicationId,
            amount,
            buttonText = 'Shopifyで支払う',
            buttonClass = 'shopify-payment-btn',
            disabled = false
        } = options;

        return `
            <button
                class="${buttonClass}"
                onclick="shopifyAPI.handlePaymentClick('${applicationId}')"
                ${disabled ? 'disabled' : ''}
                style="
                    background: linear-gradient(135deg, #95BF47 0%, #7FA138 100%);
                    color: white;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                "
            >
                <img src="https://cdn.shopify.com/s/files/1/0004/4600/5305/files/shopify-logo-white.png"
                     alt="Shopify"
                     style="height: 16px; vertical-align: middle; margin-right: 8px;">
                ${buttonText}
                ${amount ? `(¥${amount.toLocaleString()})` : ''}
            </button>
        `;
    },

    /**
     * 決済ボタンクリックハンドラー
     * @param {string} applicationId - 申請ID
     */
    async handlePaymentClick(applicationId) {
        try {
            // ローディング表示
            const button = event.target;
            const originalText = button.innerHTML;
            button.innerHTML = '処理中...';
            button.disabled = true;

            // 決済リンクを生成
            const result = await this.createPaymentLink(applicationId, {
                returnUrl: window.location.href,
                cancelUrl: window.location.href
            });

            if (result.success && result.data.paymentUrl) {
                // Shopifyチェックアウトページへリダイレクト
                window.location.href = result.data.paymentUrl;
            } else {
                throw new Error('決済リンクの生成に失敗しました');
            }

        } catch (error) {
            console.error('Payment click handler error:', error);
            alert('決済処理中にエラーが発生しました: ' + API_UTILS.getErrorMessage(error));

            // ボタンを元に戻す
            if (button) {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        }
    },

    /**
     * 決済完了コールバック処理
     * @param {Object} params - URLパラメータ
     */
    async handlePaymentCallback(params = {}) {
        const urlParams = new URLSearchParams(window.location.search);
        const checkoutId = urlParams.get('checkout_id') || params.checkoutId;
        const applicationId = urlParams.get('application_id') || params.applicationId;

        if (!checkoutId) {
            return null;
        }

        try {
            // 決済ステータスを確認
            const status = await this.getPaymentStatus(checkoutId);

            if (status.success && status.data.paid) {
                // 決済成功
                if (typeof onPaymentSuccess === 'function') {
                    onPaymentSuccess(status.data);
                }
                return status.data;
            } else {
                // 決済未完了または失敗
                if (typeof onPaymentPending === 'function') {
                    onPaymentPending(status.data);
                }
                return status.data;
            }

        } catch (error) {
            console.error('Payment callback error:', error);
            if (typeof onPaymentError === 'function') {
                onPaymentError(error);
            }
            throw error;
        }
    },

    /**
     * 決済状況ウィジェットを表示
     * @param {string} containerId - コンテナ要素ID
     * @param {string} checkoutId - チェックアウトID
     */
    async displayPaymentStatus(containerId, checkoutId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Container element not found:', containerId);
            return;
        }

        try {
            container.innerHTML = '<div class="loading">決済状況を確認中...</div>';

            const status = await this.getPaymentStatus(checkoutId);

            let statusHTML = '';
            if (status.data.paid) {
                statusHTML = `
                    <div class="payment-status success">
                        <span class="icon">✅</span>
                        <span class="text">お支払い完了</span>
                        ${status.data.orderName ? `<span class="order-id">注文番号: ${status.data.orderName}</span>` : ''}
                    </div>
                `;
            } else if (status.data.completed) {
                statusHTML = `
                    <div class="payment-status pending">
                        <span class="icon">⏳</span>
                        <span class="text">決済処理中</span>
                    </div>
                `;
            } else {
                statusHTML = `
                    <div class="payment-status waiting">
                        <span class="icon">💳</span>
                        <span class="text">お支払い待ち</span>
                        <a href="${status.data.checkoutUrl}" class="payment-link">支払いページへ</a>
                    </div>
                `;
            }

            container.innerHTML = statusHTML;

        } catch (error) {
            container.innerHTML = `
                <div class="payment-status error">
                    <span class="icon">⚠️</span>
                    <span class="text">状況を確認できませんでした</span>
                </div>
            `;
        }
    },

    /**
     * 請求書表示コンポーネントを生成
     * @param {Object} invoiceData - 請求データ
     * @returns {string} HTML文字列
     */
    generateInvoiceComponent(invoiceData) {
        const {
            items = [],
            subtotal = 0,
            tax = 0,
            shipping = 0,
            total = 0,
            currency = 'JPY'
        } = invoiceData;

        return `
            <div class="shopify-invoice">
                <h3>請求明細</h3>
                <table class="invoice-table">
                    <thead>
                        <tr>
                            <th>項目</th>
                            <th>数量</th>
                            <th>単価</th>
                            <th>金額</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.quantity}</td>
                                <td>¥${item.price.toLocaleString()}</td>
                                <td>¥${(item.price * item.quantity).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3">小計</td>
                            <td>¥${subtotal.toLocaleString()}</td>
                        </tr>
                        ${shipping > 0 ? `
                            <tr>
                                <td colspan="3">送料</td>
                                <td>¥${shipping.toLocaleString()}</td>
                            </tr>
                        ` : ''}
                        ${tax > 0 ? `
                            <tr>
                                <td colspan="3">消費税</td>
                                <td>¥${tax.toLocaleString()}</td>
                            </tr>
                        ` : ''}
                        <tr class="total-row">
                            <td colspan="3"><strong>合計</strong></td>
                            <td><strong>¥${total.toLocaleString()}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }
};