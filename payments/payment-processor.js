const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class PaymentProcessor extends EventEmitter {
    constructor(options = {}) {
        super();
        this.gateways = new Map();
        this.transactions = new Map();
        this.customers = new Map();
        this.subscriptions = new Map();
        this.webhooks = new Map();
        this.refunds = new Map();
        this.disputes = new Map();
        this.fraudChecks = new Map();
        this.paymentMethods = new Map();
        this.currencies = new Map();
        this.exchangeRates = new Map();
        this.fees = new Map();
        this.settlements = new Map();
        this.retryAttempts = new Map();
        this.riskProfiles = new Map();
        this.complianceLogs = [];
        this.auditTrail = [];
        this.metrics = {
            totalTransactions: 0,
            successfulTransactions: 0,
            failedTransactions: 0,
            totalVolume: 0,
            totalFees: 0,
            refundAmount: 0,
            disputeCount: 0
        };

        this.defaultCurrency = options.defaultCurrency || 'USD';
        this.maxRetries = options.maxRetries || 3;
        this.timeout = options.timeout || 30000;
        this.enableFraudDetection = options.enableFraudDetection || true;
        this.complianceMode = options.complianceMode || 'standard';
        this.backupEnabled = options.backupEnabled || true;
    }

    // Gateway Management
    registerGateway(name, gatewayConfig) {
        const gateway = {
            name: name,
            type: gatewayConfig.type,
            config: gatewayConfig.config,
            enabled: gatewayConfig.enabled !== false,
            priority: gatewayConfig.priority || 0,
            supportedCurrencies: gatewayConfig.supportedCurrencies || ['USD'],
            supportedMethods: gatewayConfig.supportedMethods || ['card'],
            testMode: gatewayConfig.testMode || false,
            rateLimits: gatewayConfig.rateLimits || {
                requestsPerMinute: 60,
                requestsPerHour: 1000
            },
            credentials: this.encryptCredentials(gatewayConfig.credentials),
            createdAt: new Date(),
            lastUsed: null,
            successRate: 1.0,
            averageResponseTime: 0,
            totalTransactions: 0
        };

        this.gateways.set(name, gateway);
        return gateway;
    }

    unregisterGateway(name) {
        const gateway = this.gateways.get(name);
        if (gateway) {
            // Cancel any pending operations
            this.cancelGatewayOperations(name);
            this.gateways.delete(name);
            return true;
        }
        return false;
    }

    getGateway(name) {
        return this.gateways.get(name);
    }

    listGateways() {
        return Array.from(this.gateways.values()).map(gateway => ({
            name: gateway.name,
            type: gateway.type,
            enabled: gateway.enabled,
            priority: gateway.priority,
            supportedCurrencies: gateway.supportedCurrencies
        }));
    }

    selectGateway(amount, currency, method) {
        const eligibleGateways = Array.from(this.gateways.values())
            .filter(gateway =>
                gateway.enabled &&
                gateway.supportedCurrencies.includes(currency) &&
                gateway.supportedMethods.includes(method)
            )
            .sort((a, b) => b.priority - a.priority || b.successRate - a.successRate);

        return eligibleGateways[0] || null;
    }

    // Payment Processing
    async processPayment(paymentData) {
        const transactionId = this.generateTransactionId();
        const transaction = {
            id: transactionId,
            type: 'payment',
            amount: paymentData.amount,
            currency: paymentData.currency || this.defaultCurrency,
            method: paymentData.method || 'card',
            customerId: paymentData.customerId,
            description: paymentData.description,
            metadata: paymentData.metadata || {},
            status: 'pending',
            createdAt: new Date(),
            gateway: null,
            gatewayTransactionId: null,
            attempts: [],
            fees: 0,
            netAmount: paymentData.amount
        };

        this.transactions.set(transactionId, transaction);
        this.metrics.totalTransactions++;

        try {
            this.emit('payment:started', transaction);

            // Fraud check
            if (this.enableFraudDetection) {
                const fraudResult = await this.performFraudCheck(transaction);
                if (!fraudResult.allowed) {
                    throw new Error(`Payment blocked by fraud detection: ${fraudResult.reason}`);
                }
            }

            // Select gateway
            const gateway = this.selectGateway(
                transaction.amount,
                transaction.currency,
                transaction.method
            );

            if (!gateway) {
                throw new Error(`No suitable gateway found for ${transaction.currency} ${transaction.method}`);
            }

            transaction.gateway = gateway.name;

            // Process payment
            const result = await this.processWithGateway(gateway, transaction, paymentData);

            // Calculate fees
            transaction.fees = this.calculateFees(transaction, gateway);
            transaction.netAmount = transaction.amount - transaction.fees;

            // Update metrics
            this.metrics.totalVolume += transaction.amount;
            this.metrics.totalFees += transaction.fees;

            this.emit('payment:completed', transaction, result);
            return { success: true, transaction: transaction, result: result };

        } catch (error) {
            transaction.status = 'failed';
            transaction.error = error.message;
            this.metrics.failedTransactions++;

            // Handle retries
            if (transaction.attempts.length < this.maxRetries) {
                return await this.retryPayment(transaction, error);
            }

            this.emit('payment:failed', transaction, error);
            return { success: false, transaction: transaction, error: error.message };
        }
    }

    async processWithGateway(gateway, transaction, paymentData) {
        const startTime = Date.now();

        const attempt = {
            id: this.generateAttemptId(),
            gateway: gateway.name,
            startedAt: new Date(),
            status: 'processing'
        };

        transaction.attempts.push(attempt);

        try {
            let result;

            switch (gateway.type) {
                case 'stripe':
                    result = await this.processStripePayment(gateway, transaction, paymentData);
                    break;
                case 'paypal':
                    result = await this.processPayPalPayment(gateway, transaction, paymentData);
                    break;
                case 'bank':
                    result = await this.processBankTransfer(gateway, transaction, paymentData);
                    break;
                default:
                    throw new Error(`Unsupported gateway type: ${gateway.type}`);
            }

            attempt.status = 'success';
            attempt.completedAt = new Date();
            attempt.result = result;

            transaction.status = 'completed';
            transaction.gatewayTransactionId = result.transactionId;
            transaction.completedAt = new Date();

            this.metrics.successfulTransactions++;

            // Update gateway stats
            gateway.totalTransactions++;
            gateway.lastUsed = new Date();
            const responseTime = Date.now() - startTime;
            gateway.averageResponseTime = (gateway.averageResponseTime + responseTime) / 2;

            return result;

        } catch (error) {
            attempt.status = 'failed';
            attempt.completedAt = new Date();
            attempt.error = error.message;

            // Update gateway success rate
            gateway.successRate = (gateway.successRate * gateway.totalTransactions + 0) /
                                (gateway.totalTransactions + 1);

            throw error;
        }
    }

    async processStripePayment(gateway, transaction, paymentData) {
        // Mock Stripe integration
        const credentials = this.decryptCredentials(gateway.credentials);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));

        if (Math.random() > 0.05) { // 95% success rate
            return {
                transactionId: `stripe_${Date.now()}`,
                status: 'succeeded',
                gateway: 'stripe',
                amount: transaction.amount,
                currency: transaction.currency,
                cardLast4: paymentData.cardNumber?.slice(-4),
                receiptUrl: `https://receipt.stripe.com/${transaction.id}`
            };
        } else {
            throw new Error('Card declined');
        }
    }

    async processPayPalPayment(gateway, transaction, paymentData) {
        // Mock PayPal integration
        const credentials = this.decryptCredentials(gateway.credentials);

        await new Promise(resolve => setTimeout(resolve, 300));

        if (Math.random() > 0.03) { // 97% success rate
            return {
                transactionId: `paypal_${Date.now()}`,
                status: 'COMPLETED',
                gateway: 'paypal',
                amount: transaction.amount,
                currency: transaction.currency,
                paypalTransactionId: `PAY_${Date.now()}`,
                payerId: paymentData.payerId
            };
        } else {
            throw new Error('PayPal payment failed');
        }
    }

    async processBankTransfer(gateway, transaction, paymentData) {
        // Mock bank transfer
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            transactionId: `bank_${Date.now()}`,
            status: 'pending',
            gateway: 'bank',
            amount: transaction.amount,
            currency: transaction.currency,
            referenceNumber: `REF_${Date.now()}`,
            instructions: 'Please transfer funds to account XXXX-XXXX-XXXX'
        };
    }

    async retryPayment(transaction, originalError) {
        transaction.status = 'retrying';

        const delay = Math.pow(2, transaction.attempts.length) * 1000; // Exponential backoff

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            const paymentData = {
                amount: transaction.amount,
                currency: transaction.currency,
                method: transaction.method,
                customerId: transaction.customerId
            };

            return await this.processPayment(paymentData);
        } catch (retryError) {
            transaction.status = 'failed';
            transaction.error = `Retry failed: ${retryError.message}`;
            return { success: false, transaction: transaction, error: retryError.message };
        }
    }

    // Refund Processing
    async processRefund(transactionId, refundData) {
        const originalTransaction = this.transactions.get(transactionId);
        if (!originalTransaction) {
            throw new Error('Transaction not found');
        }

        if (originalTransaction.status !== 'completed') {
            throw new Error('Can only refund completed transactions');
        }

        const refundId = this.generateRefundId();
        const refund = {
            id: refundId,
            transactionId: transactionId,
            amount: refundData.amount || originalTransaction.amount,
            currency: originalTransaction.currency,
            reason: refundData.reason || 'customer_request',
            status: 'pending',
            createdAt: new Date(),
            gateway: originalTransaction.gateway,
            gatewayRefundId: null,
            attempts: [],
            metadata: refundData.metadata || {}
        };

        this.refunds.set(refundId, refund);
        this.metrics.refundAmount += refund.amount;

        try {
            this.emit('refund:started', refund);

            const gateway = this.gateways.get(originalTransaction.gateway);
            if (!gateway) {
                throw new Error('Gateway not found for refund');
            }

            const result = await this.processRefundWithGateway(gateway, refund, originalTransaction);

            refund.status = 'completed';
            refund.gatewayRefundId = result.refundId;
            refund.completedAt = new Date();

            originalTransaction.refundedAmount = (originalTransaction.refundedAmount || 0) + refund.amount;
            originalTransaction.status = originalTransaction.refundedAmount >= originalTransaction.amount ?
                                       'fully_refunded' : 'partially_refunded';

            this.emit('refund:completed', refund, result);
            return { success: true, refund: refund, result: result };

        } catch (error) {
            refund.status = 'failed';
            refund.error = error.message;

            this.emit('refund:failed', refund, error);
            return { success: false, refund: refund, error: error.message };
        }
    }

    async processRefundWithGateway(gateway, refund, originalTransaction) {
        // Mock refund processing
        await new Promise(resolve => setTimeout(resolve, 300));

        return {
            refundId: `${gateway.type}_refund_${Date.now()}`,
            status: 'succeeded',
            amount: refund.amount,
            currency: refund.currency,
            processedAt: new Date()
        };
    }

    // Subscription Management
    createSubscription(subscriptionData) {
        const subscriptionId = this.generateSubscriptionId();
        const subscription = {
            id: subscriptionId,
            customerId: subscriptionData.customerId,
            planId: subscriptionData.planId,
            amount: subscriptionData.amount,
            currency: subscriptionData.currency || this.defaultCurrency,
            interval: subscriptionData.interval || 'month', // day, week, month, year
            intervalCount: subscriptionData.intervalCount || 1,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: this.calculatePeriodEnd(new Date(), subscriptionData.interval, subscriptionData.intervalCount),
            trialEnd: subscriptionData.trialEnd,
            canceledAt: null,
            createdAt: new Date(),
            metadata: subscriptionData.metadata || {}
        };

        this.subscriptions.set(subscriptionId, subscription);
        return subscription;
    }

    cancelSubscription(subscriptionId, cancelData = {}) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            throw new Error('Subscription not found');
        }

        subscription.status = cancelData.immediately ? 'canceled' : 'canceling';
        subscription.canceledAt = new Date();
        subscription.cancelReason = cancelData.reason;

        if (cancelData.immediately) {
            subscription.currentPeriodEnd = new Date();
        }

        return subscription;
    }

    async processSubscriptionRenewal(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            return { success: false, error: 'Subscription not found' };
        }

        if (subscription.status !== 'active') {
            return { success: false, error: 'Subscription not active' };
        }

        const now = new Date();
        if (now < subscription.currentPeriodEnd) {
            return { success: false, error: 'Subscription not due for renewal' };
        }

        try {
            const paymentData = {
                amount: subscription.amount,
                currency: subscription.currency,
                customerId: subscription.customerId,
                description: `Subscription renewal - ${subscription.planId}`,
                metadata: {
                    subscriptionId: subscriptionId,
                    renewal: true
                }
            };

            const paymentResult = await this.processPayment(paymentData);

            if (paymentResult.success) {
                subscription.currentPeriodStart = subscription.currentPeriodEnd;
                subscription.currentPeriodEnd = this.calculatePeriodEnd(
                    subscription.currentPeriodStart,
                    subscription.interval,
                    subscription.intervalCount
                );
                subscription.lastRenewal = new Date();

                this.emit('subscription:renewed', subscription, paymentResult.transaction);
                return { success: true, subscription: subscription, payment: paymentResult.transaction };
            } else {
                subscription.status = 'past_due';
                this.emit('subscription:renewal_failed', subscription, paymentResult.error);
                return { success: false, subscription: subscription, error: paymentResult.error };
            }

        } catch (error) {
            subscription.status = 'past_due';
            this.emit('subscription:renewal_failed', subscription, error);
            return { success: false, subscription: subscription, error: error.message };
        }
    }

    calculatePeriodEnd(startDate, interval, count) {
        const endDate = new Date(startDate);

        switch (interval) {
            case 'day':
                endDate.setDate(endDate.getDate() + count);
                break;
            case 'week':
                endDate.setDate(endDate.getDate() + (count * 7));
                break;
            case 'month':
                endDate.setMonth(endDate.getMonth() + count);
                break;
            case 'year':
                endDate.setFullYear(endDate.getFullYear() + count);
                break;
        }

        return endDate;
    }

    // Customer Management
    createCustomer(customerData) {
        const customerId = customerData.id || this.generateCustomerId();
        const customer = {
            id: customerId,
            email: customerData.email,
            name: customerData.name,
            paymentMethods: new Map(),
            subscriptions: new Set(),
            totalSpent: 0,
            transactionCount: 0,
            createdAt: new Date(),
            lastPayment: null,
            status: 'active',
            riskScore: 0,
            metadata: customerData.metadata || {}
        };

        this.customers.set(customerId, customer);
        return customer;
    }

    addPaymentMethod(customerId, paymentMethodData) {
        const customer = this.customers.get(customerId);
        if (!customer) {
            throw new Error('Customer not found');
        }

        const methodId = this.generatePaymentMethodId();
        const paymentMethod = {
            id: methodId,
            type: paymentMethodData.type,
            details: this.encryptPaymentDetails(paymentMethodData.details),
            isDefault: paymentMethodData.isDefault || false,
            createdAt: new Date(),
            lastUsed: null,
            status: 'active'
        };

        customer.paymentMethods.set(methodId, paymentMethod);

        if (paymentMethod.isDefault) {
            this.setDefaultPaymentMethod(customerId, methodId);
        }

        return paymentMethod;
    }

    setDefaultPaymentMethod(customerId, methodId) {
        const customer = this.customers.get(customerId);
        if (!customer) {
            throw new Error('Customer not found');
        }

        for (const [id, method] of customer.paymentMethods.entries()) {
            method.isDefault = (id === methodId);
        }
    }

    // Fraud Detection
    async performFraudCheck(transaction) {
        if (!this.enableFraudDetection) {
            return { allowed: true };
        }

        const customer = this.customers.get(transaction.customerId);
        const riskFactors = [];

        // Check transaction amount
        if (transaction.amount > 10000) {
            riskFactors.push('high_amount');
        }

        // Check customer history
        if (customer) {
            if (customer.transactionCount === 0) {
                riskFactors.push('new_customer');
            }

            if (customer.riskScore > 50) {
                riskFactors.push('high_risk_customer');
            }

            // Check for unusual patterns
            const recentTransactions = Array.from(this.transactions.values())
                .filter(t => t.customerId === transaction.customerId &&
                           t.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000))
                .length;

            if (recentTransactions > 10) {
                riskFactors.push('high_frequency');
            }
        }

        // Check geographic factors
        if (transaction.metadata.location) {
            if (customer && customer.metadata.lastLocation &&
                customer.metadata.lastLocation !== transaction.metadata.location) {
                riskFactors.push('location_change');
            }
        }

        const riskScore = riskFactors.length * 20; // Simple scoring
        const allowed = riskScore < 60;

        const fraudCheck = {
            transactionId: transaction.id,
            riskScore: riskScore,
            riskFactors: riskFactors,
            allowed: allowed,
            checkedAt: new Date(),
            recommendation: allowed ? 'approve' : 'decline'
        };

        this.fraudChecks.set(transaction.id, fraudCheck);

        return fraudCheck;
    }

    // Currency and Exchange
    setExchangeRate(fromCurrency, toCurrency, rate) {
        const key = `${fromCurrency}_${toCurrency}`;
        this.exchangeRates.set(key, {
            rate: rate,
            updatedAt: new Date()
        });
    }

    convertCurrency(amount, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) {
            return amount;
        }

        const directKey = `${fromCurrency}_${toCurrency}`;
        const inverseKey = `${toCurrency}_${fromCurrency}`;

        let rate = this.exchangeRates.get(directKey)?.rate;
        if (!rate) {
            rate = 1 / this.exchangeRates.get(inverseKey)?.rate;
        }

        if (!rate) {
            throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
        }

        return amount * rate;
    }

    // Fee Calculation
    calculateFees(transaction, gateway) {
        let fee = 0;

        // Base percentage fee
        fee += transaction.amount * 0.029; // 2.9%

        // Fixed fee
        fee += 0.30;

        // Gateway-specific fees
        if (gateway.config.additionalFees) {
            fee += gateway.config.additionalFees;
        }

        // Currency conversion fee
        if (transaction.currency !== this.defaultCurrency) {
            fee += transaction.amount * 0.01; // 1% conversion fee
        }

        return Math.round(fee * 100) / 100; // Round to 2 decimal places
    }

    // Webhook Handling
    registerWebhook(gatewayName, webhookData) {
        const webhookId = this.generateWebhookId();
        const webhook = {
            id: webhookId,
            gateway: gatewayName,
            url: webhookData.url,
            events: webhookData.events || ['payment.succeeded', 'payment.failed'],
            secret: webhookData.secret,
            active: true,
            createdAt: new Date(),
            lastTriggered: null,
            failureCount: 0
        };

        this.webhooks.set(webhookId, webhook);
        return webhook;
    }

    async processWebhook(gatewayName, eventType, payload, signature) {
        const webhooks = Array.from(this.webhooks.values())
            .filter(webhook => webhook.gateway === gatewayName && webhook.active);

        for (const webhook of webhooks) {
            if (webhook.events.includes(eventType)) {
                try {
                    await this.deliverWebhook(webhook, eventType, payload);
                    webhook.lastTriggered = new Date();
                } catch (error) {
                    webhook.failureCount++;
                    console.error(`Webhook delivery failed: ${error.message}`);
                }
            }
        }
    }

    async deliverWebhook(webhook, eventType, payload) {
        const fetch = require('node-fetch');

        const webhookPayload = {
            event: eventType,
            timestamp: new Date(),
            data: payload
        };

        const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': this.generateWebhookSignature(webhookPayload, webhook.secret)
            },
            body: JSON.stringify(webhookPayload)
        });

        if (!response.ok) {
            throw new Error(`Webhook delivery failed: ${response.status}`);
        }
    }

    generateWebhookSignature(payload, secret) {
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(JSON.stringify(payload));
        return hmac.digest('hex');
    }

    // Dispute Management
    createDispute(disputeData) {
        const disputeId = this.generateDisputeId();
        const dispute = {
            id: disputeId,
            transactionId: disputeData.transactionId,
            customerId: disputeData.customerId,
            amount: disputeData.amount,
            currency: disputeData.currency,
            reason: disputeData.reason,
            status: 'open',
            createdAt: new Date(),
            resolvedAt: null,
            resolution: null,
            evidence: [],
            notes: disputeData.notes || ''
        };

        this.disputes.set(disputeId, dispute);
        this.metrics.disputeCount++;
        return dispute;
    }

    addDisputeEvidence(disputeId, evidenceData) {
        const dispute = this.disputes.get(disputeId);
        if (!dispute) {
            throw new Error('Dispute not found');
        }

        const evidence = {
            id: this.generateEvidenceId(),
            type: evidenceData.type,
            content: evidenceData.content,
            submittedAt: new Date(),
            submittedBy: evidenceData.submittedBy
        };

        dispute.evidence.push(evidence);
        return evidence;
    }

    resolveDispute(disputeId, resolution) {
        const dispute = this.disputes.get(disputeId);
        if (!dispute) {
            throw new Error('Dispute not found');
        }

        dispute.status = 'resolved';
        dispute.resolution = resolution;
        dispute.resolvedAt = new Date();

        return dispute;
    }

    // Settlement Processing
    createSettlement(settlementData) {
        const settlementId = this.generateSettlementId();
        const settlement = {
            id: settlementId,
            gateway: settlementData.gateway,
            amount: settlementData.amount,
            currency: settlementData.currency,
            transactions: settlementData.transactions || [],
            status: 'pending',
            createdAt: new Date(),
            processedAt: null,
            fees: settlementData.fees || 0,
            netAmount: settlementData.amount - (settlementData.fees || 0)
        };

        this.settlements.set(settlementId, settlement);
        return settlement;
    }

    processSettlement(settlementId) {
        const settlement = this.settlements.get(settlementId);
        if (!settlement) {
            throw new Error('Settlement not found');
        }

        settlement.status = 'processing';

        // Mock settlement processing
        setTimeout(() => {
            settlement.status = 'completed';
            settlement.processedAt = new Date();
        }, 5000);

        return settlement;
    }

    // Compliance and Audit
    logComplianceEvent(eventData) {
        const event = {
            id: this.generateComplianceId(),
            type: eventData.type,
            details: eventData.details,
            userId: eventData.userId,
            timestamp: new Date(),
            ipAddress: eventData.ipAddress,
            userAgent: eventData.userAgent
        };

        this.complianceLogs.push(event);

        // Keep only last 10000 compliance events
        if (this.complianceLogs.length > 10000) {
            this.complianceLogs = this.complianceLogs.slice(-10000);
        }
    }

    getComplianceLogs(filters = {}) {
        let logs = this.complianceLogs;

        if (filters.type) {
            logs = logs.filter(log => log.type === filters.type);
        }

        if (filters.userId) {
            logs = logs.filter(log => log.userId === filters.userId);
        }

        if (filters.startDate) {
            logs = logs.filter(log => log.timestamp >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            logs = logs.filter(log => log.timestamp <= new Date(filters.endDate));
        }

        return logs;
    }

    // Encryption/Decryption
    encryptCredentials(credentials) {
        const cipher = crypto.createCipher('aes256', 'payment-encryption-key');
        let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    decryptCredentials(encryptedCredentials) {
        const decipher = crypto.createDecipher('aes256', 'payment-encryption-key');
        let decrypted = decipher.update(encryptedCredentials, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    }

    encryptPaymentDetails(details) {
        return this.encryptCredentials(details);
    }

    decryptPaymentDetails(encryptedDetails) {
        return this.decryptCredentials(encryptedDetails);
    }

    // Statistics and Analytics
    getTransactionStats(timeRange = null) {
        let transactions = Array.from(this.transactions.values());

        if (timeRange) {
            const cutoff = new Date(Date.now() - timeRange);
            transactions = transactions.filter(t => t.createdAt >= cutoff);
        }

        const stats = {
            total: transactions.length,
            successful: transactions.filter(t => t.status === 'completed').length,
            failed: transactions.filter(t => t.status === 'failed').length,
            pending: transactions.filter(t => t.status === 'pending').length,
            totalVolume: transactions.reduce((sum, t) => sum + t.amount, 0),
            averageAmount: 0,
            successRate: 0
        };

        if (stats.total > 0) {
            stats.averageAmount = stats.totalVolume / stats.total;
            stats.successRate = (stats.successful / stats.total) * 100;
        }

        return stats;
    }

    getGatewayStats(gatewayName = null) {
        if (gatewayName) {
            return this.gateways.get(gatewayName);
        }

        return Array.from(this.gateways.values()).map(gateway => ({
            name: gateway.name,
            type: gateway.type,
            totalTransactions: gateway.totalTransactions,
            successRate: gateway.successRate,
            averageResponseTime: gateway.averageResponseTime,
            lastUsed: gateway.lastUsed
        }));
    }

    getCustomerStats(customerId = null) {
        if (customerId) {
            const customer = this.customers.get(customerId);
            if (!customer) return null;

            const transactions = Array.from(this.transactions.values())
                .filter(t => t.customerId === customerId);

            return {
                customerId: customerId,
                totalSpent: customer.totalSpent,
                transactionCount: customer.transactionCount,
                lastPayment: customer.lastPayment,
                paymentMethods: customer.paymentMethods.size,
                subscriptions: customer.subscriptions.size
            };
        }

        return Array.from(this.customers.values()).map(customer => ({
            id: customer.id,
            totalSpent: customer.totalSpent,
            transactionCount: customer.transactionCount,
            paymentMethods: customer.paymentMethods.size,
            subscriptions: customer.subscriptions.size
        }));
    }

    // Backup and Recovery
    async createBackup() {
        const backup = {
            timestamp: new Date(),
            transactions: Array.from(this.transactions.entries()),
            customers: Array.from(this.customers.entries()),
            subscriptions: Array.from(this.subscriptions.entries()),
            refunds: Array.from(this.refunds.entries()),
            disputes: Array.from(this.disputes.entries()),
            metrics: { ...this.metrics }
        };

        const backupPath = `./backups/payment_backup_${Date.now()}.json`;
        const dir = path.dirname(backupPath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
        return backupPath;
    }

    async restoreFromBackup(backupPath) {
        if (!fs.existsSync(backupPath)) {
            throw new Error('Backup file not found');
        }

        const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

        // Restore data
        this.transactions = new Map(backup.transactions);
        this.customers = new Map(backup.customers);
        this.subscriptions = new Map(backup.subscriptions);
        this.refunds = new Map(backup.refunds);
        this.disputes = new Map(backup.disputes);
        this.metrics = backup.metrics;

        return true;
    }

    // Utility Methods
    generateTransactionId() {
        return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateRefundId() {
        return `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateCustomerId() {
        return `cus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generatePaymentMethodId() {
        return `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateWebhookId() {
        return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateDisputeId() {
        return `dsp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateSettlementId() {
        return `stl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateAttemptId() {
        return `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateComplianceId() {
        return `cmp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    cancelGatewayOperations(gatewayName) {
        // Implementation would cancel any pending operations for the gateway
        console.log(`Cancelling operations for gateway: ${gatewayName}`);
    }

    // Export/Import
    exportData(format = 'json') {
        const data = {
            gateways: Array.from(this.gateways.entries()),
            transactions: Array.from(this.transactions.entries()),
            customers: Array.from(this.customers.entries()),
            subscriptions: Array.from(this.subscriptions.entries()),
            refunds: Array.from(this.refunds.entries()),
            disputes: Array.from(this.disputes.entries()),
            webhooks: Array.from(this.webhooks.entries()),
            config: {
                defaultCurrency: this.defaultCurrency,
                maxRetries: this.maxRetries,
                timeout: this.timeout,
                enableFraudDetection: this.enableFraudDetection,
                complianceMode: this.complianceMode
            }
        };

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }

        return data;
    }

    importData(data) {
        // Clear existing data
        this.gateways.clear();
        this.transactions.clear();
        this.customers.clear();
        this.subscriptions.clear();
        this.refunds.clear();
        this.disputes.clear();
        this.webhooks.clear();

        // Import data
        for (const [name, gateway] of data.gateways) {
            this.gateways.set(name, gateway);
        }

        for (const [id, transaction] of data.transactions) {
            this.transactions.set(id, transaction);
        }

        for (const [id, customer] of data.customers) {
            this.customers.set(id, customer);
        }

        for (const [id, subscription] of data.subscriptions) {
            this.subscriptions.set(id, subscription);
        }

        for (const [id, refund] of data.refunds) {
            this.refunds.set(id, refund);
        }

        for (const [id, dispute] of data.disputes) {
            this.disputes.set(id, dispute);
        }

        for (const [id, webhook] of data.webhooks) {
            this.webhooks.set(id, webhook);
        }

        // Import config
        const config = data.config;
        if (config) {
            this.defaultCurrency = config.defaultCurrency || 'USD';
            this.maxRetries = config.maxRetries || 3;
            this.timeout = config.timeout || 30000;
            this.enableFraudDetection = config.enableFraudDetection || true;
            this.complianceMode = config.complianceMode || 'standard';
        }

        return true;
    }

    // Cleanup
    cleanup() {
        // Remove old transactions (older than 2 years)
        const cutoff = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);

        for (const [id, transaction] of this.transactions.entries()) {
            if (transaction.createdAt < cutoff && transaction.status === 'completed') {
                this.transactions.delete(id);
            }
        }

        // Clean up old compliance logs
        if (this.complianceLogs.length > 5000) {
            this.complianceLogs = this.complianceLogs.slice(-5000);
        }
    }

    // Health Check
    async healthCheck() {
        const results = {
            overall: 'healthy',
            checks: {}
        };

        // Check gateways
        const enabledGateways = Array.from(this.gateways.values()).filter(g => g.enabled);
        results.checks.gateways = {
            status: enabledGateways.length > 0 ? 'healthy' : 'unhealthy',
            enabledCount: enabledGateways.length,
            totalCount: this.gateways.size
        };

        // Check database connectivity (mock)
        results.checks.database = {
            status: 'healthy',
            lastCheck: new Date()
        };

        // Check recent transaction success rate
        const recentStats = this.getTransactionStats(24 * 60 * 60 * 1000); // Last 24 hours
        results.checks.transactions = {
            status: recentStats.successRate > 95 ? 'healthy' : 'warning',
            successRate: recentStats.successRate,
            totalTransactions: recentStats.total
        };

        // Determine overall health
        const unhealthyChecks = Object.values(results.checks).filter(check => check.status !== 'healthy');
        if (unhealthyChecks.length > 0) {
            results.overall = 'unhealthy';
        }

        return results;
    }

    // Destroy
    destroy() {
        this.gateways.clear();
        this.transactions.clear();
        this.customers.clear();
        this.subscriptions.clear();
        this.refunds.clear();
        this.disputes.clear();
        this.webhooks.clear();
        this.fraudChecks.clear();
        this.retryAttempts.clear();
        this.riskProfiles.clear();
        this.complianceLogs = [];
        this.auditTrail = [];
        this.removeAllListeners();
    }
}

module.exports = PaymentProcessor;
