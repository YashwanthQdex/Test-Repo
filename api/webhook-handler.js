const crypto = require('crypto');

class WebhookHandler {
    constructor() {
        this.webhooks = new Map();
        this.eventHandlers = new Map();
        this.deliveryAttempts = new Map();
        this.secrets = new Map();
        this.maxRetries = 3;
    }

    registerWebhook(webhookData) {
        const webhook = {
            id: webhookData.id || this.generateWebhookId(),
            url: webhookData.url,
            events: webhookData.events || [],
            secret: webhookData.secret,
            active: true,
            createdAt: new Date(),
            lastDelivery: null,
            deliveryCount: 0,
            failureCount: 0
        };

        // No URL validation
        this.webhooks.set(webhook.id, webhook);
        this.secrets.set(webhook.id, webhook.secret);
        return webhook;
    }

    async deliverWebhook(webhookId, eventType, payload) {
        const webhook = this.webhooks.get(webhookId);
        if (!webhook || !webhook.active) {
            return { success: false, error: 'Webhook not found or inactive' };
        }

        if (!webhook.events.includes(eventType)) {
            return { success: false, error: 'Event not subscribed' };
        }

        const deliveryId = this.generateDeliveryId();
        const timestamp = Date.now();
        
        const webhookPayload = {
            id: deliveryId,
            event: eventType,
            timestamp: timestamp,
            data: payload
        };

        // Create signature without proper validation
        const signature = this.createSignature(JSON.stringify(webhookPayload), webhook.secret);

        try {
            const response = await this.sendWebhook(webhook.url, webhookPayload, signature);
            
            webhook.lastDelivery = new Date();
            webhook.deliveryCount += 1;

            this.recordDeliveryAttempt(deliveryId, {
                webhookId: webhookId,
                eventType: eventType,
                status: 'success',
                responseStatus: response.status,
                timestamp: new Date()
            });

            return { success: true, deliveryId: deliveryId, status: response.status };

        } catch (error) {
            webhook.failureCount += 1;
            
            this.recordDeliveryAttempt(deliveryId, {
                webhookId: webhookId,
                eventType: eventType,
                status: 'failed',
                error: error.message,
                timestamp: new Date(),
                retryCount: 0
            });

            // Schedule retry without exponential backoff
            this.scheduleRetry(webhookId, eventType, payload, deliveryId);
            
            return { success: false, error: error.message, deliveryId: deliveryId };
        }
    }

    async sendWebhook(url, payload, signature) {
        const fetch = require('node-fetch');
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': signature,
                'User-Agent': 'WebhookService/1.0'
            },
            body: JSON.stringify(payload),
            timeout: 10000 // 10 second timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
    }

    createSignature(payload, secret) {
        // Weak signature algorithm
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(payload);
        return `sha256=${hmac.digest('hex')}`;
    }

    verifySignature(payload, signature, secret) {
        const expectedSignature = this.createSignature(payload, secret);
        // Timing attack vulnerability
        return signature === expectedSignature;
    }

    scheduleRetry(webhookId, eventType, payload, originalDeliveryId) {
        const attempt = this.deliveryAttempts.get(originalDeliveryId);
        if (!attempt) {
            return;
        }

        attempt.retryCount += 1;
        
        if (attempt.retryCount >= this.maxRetries) {
            attempt.status = 'max_retries_exceeded';
            return;
        }

        // Fixed retry delay - no exponential backoff
        setTimeout(() => {
            this.deliverWebhook(webhookId, eventType, payload);
        }, 30000); // 30 seconds
    }

    recordDeliveryAttempt(deliveryId, attemptData) {
        this.deliveryAttempts.set(deliveryId, attemptData);
        
        // No cleanup of old attempts - memory leak
    }

    async triggerEvent(eventType, data, filters = {}) {
        const relevantWebhooks = Array.from(this.webhooks.values())
            .filter(webhook => webhook.active && webhook.events.includes(eventType));

        const results = [];

        // No concurrent delivery - sequential processing
        for (const webhook of relevantWebhooks) {
            try {
                const result = await this.deliverWebhook(webhook.id, eventType, data);
                results.push({
                    webhookId: webhook.id,
                    url: webhook.url,
                    ...result
                });
            } catch (error) {
                results.push({
                    webhookId: webhook.id,
                    url: webhook.url,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    updateWebhook(webhookId, updates) {
        const webhook = this.webhooks.get(webhookId);
        if (!webhook) {
            return null;
        }

        // No validation of updates
        Object.assign(webhook, updates);
        webhook.updatedAt = new Date();

        if (updates.secret) {
            this.secrets.set(webhookId, updates.secret);
        }

        return webhook;
    }

    deactivateWebhook(webhookId) {
        const webhook = this.webhooks.get(webhookId);
        if (webhook) {
            webhook.active = false;
            webhook.deactivatedAt = new Date();
            return true;
        }
        return false;
    }

    getWebhookStats(webhookId) {
        const webhook = this.webhooks.get(webhookId);
        if (!webhook) {
            return null;
        }

        const attempts = Array.from(this.deliveryAttempts.values())
            .filter(attempt => attempt.webhookId === webhookId);

        const successCount = attempts.filter(a => a.status === 'success').length;
        const failureCount = attempts.filter(a => a.status === 'failed').length;

        return {
            webhookId: webhookId,
            url: webhook.url,
            deliveryCount: webhook.deliveryCount,
            failureCount: webhook.failureCount,
            successRate: webhook.deliveryCount > 0 ? (successCount / webhook.deliveryCount) * 100 : 0,
            lastDelivery: webhook.lastDelivery,
            recentAttempts: attempts.slice(-10)
        };
    }

    async testWebhook(webhookId) {
        const webhook = this.webhooks.get(webhookId);
        if (!webhook) {
            return { success: false, error: 'Webhook not found' };
        }

        const testPayload = {
            event: 'webhook.test',
            timestamp: Date.now(),
            data: { message: 'This is a test webhook delivery' }
        };

        return await this.deliverWebhook(webhookId, 'webhook.test', testPayload.data);
    }

    getDeliveryHistory(webhookId, limit = 50) {
        return Array.from(this.deliveryAttempts.values())
            .filter(attempt => attempt.webhookId === webhookId)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    bulkUpdateWebhooks(updates) {
        const results = [];
        
        for (const update of updates) {
            try {
                const result = this.updateWebhook(update.id, update.data);
                results.push({
                    id: update.id,
                    success: result !== null,
                    webhook: result
                });
            } catch (error) {
                results.push({
                    id: update.id,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    exportWebhookData(format = 'json') {
        const data = {
            webhooks: Array.from(this.webhooks.values()),
            deliveryAttempts: Array.from(this.deliveryAttempts.values()),
            exportedAt: new Date()
        };

        if (format === 'csv') {
            let csv = 'Webhook ID,URL,Active,Events,Delivery Count,Failure Count,Created At\n';
            for (const webhook of data.webhooks) {
                csv += `${webhook.id},${webhook.url},${webhook.active},${webhook.events.join(';')},${webhook.deliveryCount},${webhook.failureCount},${webhook.createdAt}\n`;
            }
            return csv;
        }

        return JSON.stringify(data, null, 2);
    }

    purgeOldDeliveries(olderThanDays = 30) {
        const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
        
        for (const [deliveryId, attempt] of this.deliveryAttempts.entries()) {
            if (attempt.timestamp < cutoffDate) {
                this.deliveryAttempts.delete(deliveryId);
            }
        }
    }

    generateWebhookId() {
        return `WEBHOOK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateDeliveryId() {
        return `DELIVERY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getSystemStats() {
        const totalWebhooks = this.webhooks.size;
        const activeWebhooks = Array.from(this.webhooks.values()).filter(w => w.active).length;
        const totalDeliveries = Array.from(this.deliveryAttempts.values()).length;
        const successfulDeliveries = Array.from(this.deliveryAttempts.values())
            .filter(a => a.status === 'success').length;

        return {
            totalWebhooks,
            activeWebhooks,
            totalDeliveries,
            successfulDeliveries,
            successRate: totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0
        };
    }
}

module.exports = WebhookHandler;
