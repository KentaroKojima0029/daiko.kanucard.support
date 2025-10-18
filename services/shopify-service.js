/**
 * Shopify Service
 * Shopifyとの連携機能を提供
 *
 * 機能:
 * - 商品情報の取得
 * - チェックアウトセッションの作成
 * - 支払いリンクの生成
 * - 注文の作成と管理
 * - 顧客情報の同期
 */

const axios = require('axios');
require('dotenv').config();

class ShopifyService {
    constructor() {
        // Shopify設定
        this.config = {
            storeDomain: process.env.SHOPIFY_STORE_DOMAIN,
            storefrontAccessToken: process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,
            adminApiKey: process.env.SHOPIFY_ADMIN_API_KEY,
            adminApiSecret: process.env.SHOPIFY_ADMIN_API_SECRET,
            webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET,
            checkoutApiKey: process.env.SHOPIFY_CHECKOUT_API_KEY,
            enableCheckout: process.env.SHOPIFY_ENABLE_CHECKOUT === 'true',
            testMode: process.env.SHOPIFY_TEST_MODE === 'true',

            // 商品ID
            productIds: {
                agency: process.env.SHOPIFY_PRODUCT_ID_AGENCY,
                grading: process.env.SHOPIFY_PRODUCT_ID_GRADING,
                variantStandard: process.env.SHOPIFY_VARIANT_ID_STANDARD,
                variantExpress: process.env.SHOPIFY_VARIANT_ID_EXPRESS
            }
        };

        // GraphQL エンドポイント
        this.endpoints = {
            storefront: `https://${this.config.storeDomain}/api/2024-01/graphql.json`,
            admin: `https://${this.config.storeDomain}/admin/api/2024-01/graphql.json`
        };

        // APIクライアント初期化
        if (this.config.enableCheckout) {
            this.initializeClients();
        }
    }

    /**
     * APIクライアントの初期化
     */
    initializeClients() {
        // Storefront API クライアント
        this.storefrontClient = axios.create({
            baseURL: this.endpoints.storefront,
            headers: {
                'X-Shopify-Storefront-Access-Token': this.config.storefrontAccessToken,
                'Content-Type': 'application/json'
            }
        });

        // Admin API クライアント
        this.adminClient = axios.create({
            baseURL: this.endpoints.admin,
            headers: {
                'X-Shopify-Access-Token': this.config.adminApiSecret,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Shopifyが有効かチェック
     */
    isEnabled() {
        return this.config.enableCheckout && this.config.storeDomain && this.config.storefrontAccessToken;
    }

    /**
     * チェックアウトセッションを作成
     * @param {Object} applicationData - 申請データ
     * @returns {Promise<Object>} チェックアウト情報
     */
    async createCheckout(applicationData) {
        if (!this.isEnabled()) {
            throw new Error('Shopify checkout is not enabled');
        }

        try {
            const mutation = `
                mutation checkoutCreate($input: CheckoutCreateInput!) {
                    checkoutCreate(input: $input) {
                        checkout {
                            id
                            webUrl
                            totalPrice {
                                amount
                                currencyCode
                            }
                            lineItems(first: 5) {
                                edges {
                                    node {
                                        title
                                        quantity
                                    }
                                }
                            }
                        }
                        checkoutUserErrors {
                            field
                            message
                        }
                    }
                }
            `;

            // チェックアウト用のラインアイテムを作成
            const lineItems = this.createLineItems(applicationData);

            const variables = {
                input: {
                    lineItems,
                    email: applicationData.email,
                    note: `PSA代行申請 #${applicationData.id}`,
                    customAttributes: [
                        { key: 'application_id', value: applicationData.id },
                        { key: 'service_type', value: applicationData.serviceType || 'psa_agency' }
                    ]
                }
            };

            const response = await this.storefrontClient.post('', {
                query: mutation,
                variables
            });

            if (response.data.data.checkoutCreate.checkoutUserErrors.length > 0) {
                throw new Error(response.data.data.checkoutCreate.checkoutUserErrors[0].message);
            }

            return response.data.data.checkoutCreate.checkout;

        } catch (error) {
            console.error('Shopify checkout creation error:', error);
            throw error;
        }
    }

    /**
     * ラインアイテムを作成
     * @param {Object} applicationData - 申請データ
     * @returns {Array} ラインアイテム配列
     */
    createLineItems(applicationData) {
        const lineItems = [];

        // 代行手数料
        if (applicationData.agencyFee) {
            lineItems.push({
                variantId: this.getVariantId(applicationData.planType),
                quantity: 1
            });
        }

        // カード枚数に基づく手数料
        if (applicationData.cards && applicationData.cards.length > 0) {
            const cardCount = applicationData.cards.length;
            // 必要に応じて追加の商品バリアントを追加
        }

        return lineItems;
    }

    /**
     * プランタイプに基づくバリアントIDを取得
     */
    getVariantId(planType) {
        switch (planType) {
            case 'express':
                return this.config.productIds.variantExpress;
            case 'standard':
            default:
                return this.config.productIds.variantStandard;
        }
    }

    /**
     * 決済リンクを生成
     * @param {Object} applicationData - 申請データ
     * @returns {Promise<string>} 決済URL
     */
    async generatePaymentLink(applicationData) {
        if (!this.isEnabled()) {
            console.log('Shopify is not enabled, returning mock payment link');
            return `https://example.com/payment?id=${applicationData.id}`;
        }

        try {
            const checkout = await this.createCheckout(applicationData);
            return checkout.webUrl;
        } catch (error) {
            console.error('Error generating payment link:', error);
            throw error;
        }
    }

    /**
     * 注文ステータスを確認
     * @param {string} checkoutId - チェックアウトID
     * @returns {Promise<Object>} 注文ステータス
     */
    async getOrderStatus(checkoutId) {
        if (!this.isEnabled()) {
            return { status: 'test', paid: false };
        }

        try {
            const query = `
                query getCheckout($id: ID!) {
                    node(id: $id) {
                        ... on Checkout {
                            id
                            completedAt
                            order {
                                id
                                name
                                displayFinancialStatus
                                displayFulfillmentStatus
                            }
                        }
                    }
                }
            `;

            const response = await this.storefrontClient.post('', {
                query,
                variables: { id: checkoutId }
            });

            const checkout = response.data.data.node;

            return {
                completed: checkout.completedAt !== null,
                order: checkout.order,
                paid: checkout.order?.displayFinancialStatus === 'PAID'
            };

        } catch (error) {
            console.error('Error checking order status:', error);
            throw error;
        }
    }

    /**
     * Webhook署名を検証
     * @param {string} rawBody - リクエストボディ
     * @param {string} signature - Shopify署名
     * @returns {boolean} 検証結果
     */
    verifyWebhook(rawBody, signature) {
        const crypto = require('crypto');
        const hash = crypto
            .createHmac('sha256', this.config.webhookSecret)
            .update(rawBody, 'utf8')
            .digest('base64');

        return hash === signature;
    }

    /**
     * 顧客を作成または更新
     * @param {Object} customerData - 顧客データ
     * @returns {Promise<Object>} 顧客情報
     */
    async upsertCustomer(customerData) {
        if (!this.isEnabled()) {
            return { id: 'test_customer_' + Date.now() };
        }

        try {
            const mutation = `
                mutation customerCreate($input: CustomerCreateInput!) {
                    customerCreate(input: $input) {
                        customer {
                            id
                            email
                            firstName
                            lastName
                            phone
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }
            `;

            const variables = {
                input: {
                    email: customerData.email,
                    firstName: customerData.firstName || customerData.name?.split(' ')[0],
                    lastName: customerData.lastName || customerData.name?.split(' ')[1],
                    phone: customerData.phone,
                    acceptsMarketing: false
                }
            };

            const response = await this.adminClient.post('', {
                query: mutation,
                variables
            });

            if (response.data.data.customerCreate.userErrors.length > 0) {
                // 既存顧客の場合は検索
                return await this.findCustomer(customerData.email);
            }

            return response.data.data.customerCreate.customer;

        } catch (error) {
            console.error('Error creating customer:', error);
            throw error;
        }
    }

    /**
     * メールアドレスで顧客を検索
     * @param {string} email - メールアドレス
     * @returns {Promise<Object>} 顧客情報
     */
    async findCustomer(email) {
        if (!this.isEnabled()) {
            return null;
        }

        try {
            const query = `
                query findCustomer($query: String!) {
                    customers(first: 1, query: $query) {
                        edges {
                            node {
                                id
                                email
                                firstName
                                lastName
                                phone
                            }
                        }
                    }
                }
            `;

            const response = await this.adminClient.post('', {
                query,
                variables: { query: `email:${email}` }
            });

            const customers = response.data.data.customers.edges;
            return customers.length > 0 ? customers[0].node : null;

        } catch (error) {
            console.error('Error finding customer:', error);
            throw error;
        }
    }

    /**
     * テストモードかチェック
     */
    isTestMode() {
        return this.config.testMode;
    }

    /**
     * 請求書を作成（Draft Order）
     * @param {Object} invoiceData - 請求データ
     * @returns {Promise<Object>} 請求書情報
     */
    async createInvoice(invoiceData) {
        if (!this.isEnabled()) {
            return {
                id: 'test_invoice_' + Date.now(),
                invoiceUrl: `https://example.com/invoice/${Date.now()}`
            };
        }

        try {
            const mutation = `
                mutation draftOrderCreate($input: DraftOrderInput!) {
                    draftOrderCreate(input: $input) {
                        draftOrder {
                            id
                            name
                            invoiceUrl
                            totalPrice
                        }
                        userErrors {
                            field
                            message
                        }
                    }
                }
            `;

            const variables = {
                input: {
                    customerId: invoiceData.customerId,
                    email: invoiceData.email,
                    lineItems: this.createLineItems(invoiceData),
                    note: invoiceData.note || `PSA代行サービス請求 #${invoiceData.applicationId}`,
                    tags: ['psa_agency', `application_${invoiceData.applicationId}`]
                }
            };

            const response = await this.adminClient.post('', {
                query: mutation,
                variables
            });

            if (response.data.data.draftOrderCreate.userErrors.length > 0) {
                throw new Error(response.data.data.draftOrderCreate.userErrors[0].message);
            }

            return response.data.data.draftOrderCreate.draftOrder;

        } catch (error) {
            console.error('Error creating invoice:', error);
            throw error;
        }
    }
}

// シングルトンとしてエクスポート
module.exports = new ShopifyService();