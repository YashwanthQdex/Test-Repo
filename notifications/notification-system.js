const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class NotificationSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        this.channels = new Map();
        this.templates = new Map();
        this.subscribers = new Map();
        this.notificationHistory = [];
        this.preferences = new Map();
        this.rateLimiters = new Map();
        this.retryQueues = new Map();
        this.deliveryAttempts = new Map();
        this.templates = new Map();
        this.notificationRules = new Map();
        this.scheduledNotifications = new Map();
        this.archivedNotifications = [];
        this.deliveryStats = {
            total: 0,
            successful: 0,
            failed: 0,
            pending: 0
        };
        this.maxRetries = options.maxRetries || 3;
        this.defaultChannel = options.defaultChannel || 'email';
        this.enableArchiving = options.enableArchiving || true;
        this.archiveThreshold = options.archiveThreshold || 1000;
        this.rateLimitWindow = options.rateLimitWindow || 3600000; // 1 hour
        this.maxNotificationsPerWindow = options.maxNotificationsPerWindow || 100;
    }

    // Channel Management
    registerChannel(name, channelConfig) {
        const channel = {
            name: name,
            type: channelConfig.type,
            config: channelConfig.config,
            enabled: channelConfig.enabled !== false,
            priority: channelConfig.priority || 0,
            retryPolicy: channelConfig.retryPolicy || {
                maxAttempts: this.maxRetries,
                backoffMultiplier: 2,
                initialDelay: 1000
            },
            rateLimit: channelConfig.rateLimit || {
                maxPerWindow: this.maxNotificationsPerWindow,
                windowMs: this.rateLimitWindow
            },
            deliveryStats: {
                sent: 0,
                failed: 0,
                pending: 0
            },
            createdAt: new Date(),
            lastUsed: null
        };

        this.channels.set(name, channel);
        this.setupRateLimiter(name, channel.rateLimit);
        return channel;
    }

    unregisterChannel(name) {
        const channel = this.channels.get(name);
        if (channel) {
            // Cancel any pending retries
            this.cancelChannelRetries(name);
            this.channels.delete(name);
            this.rateLimiters.delete(name);
            return true;
        }
        return false;
    }

    getChannel(name) {
        return this.channels.get(name);
    }

    listChannels() {
        return Array.from(this.channels.values()).map(channel => ({
            name: channel.name,
            type: channel.type,
            enabled: channel.enabled,
            priority: channel.priority
        }));
    }

    enableChannel(name) {
        const channel = this.channels.get(name);
        if (channel) {
            channel.enabled = true;
            return true;
        }
        return false;
    }

    disableChannel(name) {
        const channel = this.channels.get(name);
        if (channel) {
            channel.enabled = false;
            return true;
        }
        return false;
    }

    // Template Management
    createTemplate(templateId, templateData) {
        const template = {
            id: templateId,
            name: templateData.name,
            type: templateData.type || 'text',
            subject: templateData.subject,
            content: templateData.content,
            variables: templateData.variables || [],
            channels: templateData.channels || [this.defaultChannel],
            priority: templateData.priority || 'normal',
            category: templateData.category || 'general',
            createdAt: new Date(),
            lastUsed: null,
            usageCount: 0,
            metadata: templateData.metadata || {}
        };

        this.templates.set(templateId, template);
        return template;
    }

    updateTemplate(templateId, updates) {
        const template = this.templates.get(templateId);
        if (!template) {
            return null;
        }

        Object.assign(template, updates);
        template.updatedAt = new Date();
        return template;
    }

    deleteTemplate(templateId) {
        return this.templates.delete(templateId);
    }

    getTemplate(templateId) {
        return this.templates.get(templateId);
    }

    listTemplates(category = null) {
        let templates = Array.from(this.templates.values());

        if (category) {
            templates = templates.filter(template => template.category === category);
        }

        return templates.map(template => ({
            id: template.id,
            name: template.name,
            type: template.type,
            category: template.category,
            channels: template.channels
        }));
    }

    renderTemplate(templateId, variables = {}) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template '${templateId}' not found`);
        }

        let subject = template.subject;
        let content = template.content;

        // Replace variables
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, value);
            content = content.replace(regex, value);
        }

        template.usageCount++;
        template.lastUsed = new Date();

        return {
            subject: subject,
            content: content,
            type: template.type
        };
    }

    // Subscriber Management
    subscribe(userId, preferences = {}) {
        const subscriber = {
            userId: userId,
            preferences: {
                channels: preferences.channels || [this.defaultChannel],
                categories: preferences.categories || ['general'],
                quietHours: preferences.quietHours || null,
                timezone: preferences.timezone || 'UTC',
                language: preferences.language || 'en'
            },
            subscriptions: new Map(),
            createdAt: new Date(),
            lastActivity: new Date(),
            isActive: true,
            metadata: preferences.metadata || {}
        };

        this.subscribers.set(userId, subscriber);
        return subscriber;
    }

    unsubscribe(userId) {
        const subscriber = this.subscribers.get(userId);
        if (subscriber) {
            subscriber.isActive = false;
            subscriber.unsubscribedAt = new Date();
            return true;
        }
        return false;
    }

    updateSubscriberPreferences(userId, preferences) {
        const subscriber = this.subscribers.get(userId);
        if (!subscriber) {
            return null;
        }

        Object.assign(subscriber.preferences, preferences);
        subscriber.lastActivity = new Date();
        return subscriber;
    }

    getSubscriber(userId) {
        return this.subscribers.get(userId);
    }

    getActiveSubscribers() {
        return Array.from(this.subscribers.values())
            .filter(subscriber => subscriber.isActive);
    }

    subscribeToCategory(userId, category) {
        const subscriber = this.subscribers.get(userId);
        if (!subscriber) {
            return false;
        }

        if (!subscriber.subscriptions.has(category)) {
            subscriber.subscriptions.set(category, {
                subscribedAt: new Date(),
                notificationCount: 0
            });
        }

        return true;
    }

    unsubscribeFromCategory(userId, category) {
        const subscriber = this.subscribers.get(userId);
        if (!subscriber) {
            return false;
        }

        return subscriber.subscriptions.delete(category);
    }

    getSubscriberCategories(userId) {
        const subscriber = this.subscribers.get(userId);
        if (!subscriber) {
            return [];
        }

        return Array.from(subscriber.subscriptions.keys());
    }

    // Notification Creation and Sending
    async sendNotification(notificationData) {
        const notification = {
            id: this.generateNotificationId(),
            type: notificationData.type || 'info',
            priority: notificationData.priority || 'normal',
            category: notificationData.category || 'general',
            recipient: notificationData.recipient,
            templateId: notificationData.templateId,
            variables: notificationData.variables || {},
            channels: notificationData.channels || null,
            scheduledFor: notificationData.scheduledFor || null,
            expiresAt: notificationData.expiresAt || null,
            createdAt: new Date(),
            status: 'pending',
            deliveryAttempts: [],
            metadata: notificationData.metadata || {}
        };

        this.notificationHistory.push(notification);
        this.deliveryStats.total++;
        this.deliveryStats.pending++;

        // Check if scheduled
        if (notification.scheduledFor) {
            this.scheduleNotification(notification);
            return notification;
        }

        // Send immediately
        await this.deliverNotification(notification);
        return notification;
    }

    async deliverNotification(notification) {
        const subscriber = this.subscribers.get(notification.recipient);
        if (!subscriber || !subscriber.isActive) {
            this.markAsFailed(notification, 'Subscriber not found or inactive');
            return;
        }

        // Check preferences
        if (!this.checkSubscriberPreferences(subscriber, notification)) {
            this.markAsFailed(notification, 'Blocked by subscriber preferences');
            return;
        }

        // Determine channels
        const channels = notification.channels || subscriber.preferences.channels;
        const deliveryPromises = [];

        for (const channelName of channels) {
            const channel = this.channels.get(channelName);
            if (channel && channel.enabled) {
                // Check rate limits
                if (!this.checkRateLimit(channelName, notification.recipient)) {
                    console.log(`Rate limit exceeded for channel ${channelName}`);
                    continue;
                }

                deliveryPromises.push(this.deliverToChannel(notification, channel));
            }
        }

        try {
            const results = await Promise.allSettled(deliveryPromises);
            const successful = results.filter(result => result.status === 'fulfilled').length;
            const failed = results.filter(result => result.status === 'rejected').length;

            if (successful > 0) {
                this.markAsDelivered(notification);
            } else {
                await this.handleDeliveryFailure(notification, 'All channels failed');
            }
        } catch (error) {
            await this.handleDeliveryFailure(notification, error.message);
        }
    }

    async deliverToChannel(notification, channel) {
        const attempt = {
            id: this.generateAttemptId(),
            channel: channel.name,
            startedAt: new Date(),
            status: 'in_progress'
        };

        notification.deliveryAttempts.push(attempt);

        try {
            const rendered = this.renderTemplate(notification.templateId, notification.variables);

            let result;
            switch (channel.type) {
                case 'email':
                    result = await this.deliverEmail(channel, notification, rendered);
                    break;
                case 'sms':
                    result = await this.deliverSMS(channel, notification, rendered);
                    break;
                case 'push':
                    result = await this.deliverPush(channel, notification, rendered);
                    break;
                case 'webhook':
                    result = await this.deliverWebhook(channel, notification, rendered);
                    break;
                default:
                    throw new Error(`Unsupported channel type: ${channel.type}`);
            }

            attempt.status = 'success';
            attempt.completedAt = new Date();
            attempt.result = result;

            channel.deliveryStats.sent++;
            channel.lastUsed = new Date();

            this.emit('notification:delivered', notification, channel, result);

        } catch (error) {
            attempt.status = 'failed';
            attempt.completedAt = new Date();
            attempt.error = error.message;

            channel.deliveryStats.failed++;

            this.emit('notification:failed', notification, channel, error);
            throw error;
        }
    }

    async deliverEmail(channel, notification, rendered) {
        // Mock email delivery
        const emailData = {
            to: notification.recipient,
            subject: rendered.subject,
            html: rendered.content,
            from: channel.config.from || 'noreply@system.com'
        };

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
            messageId: `email_${Date.now()}`,
            channel: 'email',
            recipient: notification.recipient
        };
    }

    async deliverSMS(channel, notification, rendered) {
        // Mock SMS delivery
        const smsData = {
            to: notification.recipient,
            message: rendered.content.substring(0, 160), // SMS length limit
            from: channel.config.from || 'SYSTEM'
        };

        await new Promise(resolve => setTimeout(resolve, 50));

        return {
            messageId: `sms_${Date.now()}`,
            channel: 'sms',
            recipient: notification.recipient
        };
    }

    async deliverPush(channel, notification, rendered) {
        // Mock push notification delivery
        const pushData = {
            to: notification.recipient,
            title: rendered.subject,
            body: rendered.content,
            data: notification.metadata
        };

        await new Promise(resolve => setTimeout(resolve, 30));

        return {
            messageId: `push_${Date.now()}`,
            channel: 'push',
            recipient: notification.recipient
        };
    }

    async deliverWebhook(channel, notification, rendered) {
        const fetch = require('node-fetch');

        const payload = {
            notification: notification,
            rendered: rendered,
            timestamp: new Date()
        };

        const response = await fetch(channel.config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${channel.config.token}`,
                'X-Webhook-Source': 'notification-system'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Webhook delivery failed: ${response.status}`);
        }

        return {
            messageId: `webhook_${Date.now()}`,
            channel: 'webhook',
            status: response.status
        };
    }

    checkSubscriberPreferences(subscriber, notification) {
        // Check if category is subscribed
        if (!subscriber.subscriptions.has(notification.category)) {
            return false;
        }

        // Check quiet hours
        if (subscriber.preferences.quietHours) {
            const now = new Date();
            const currentHour = now.getHours();

            if (currentHour >= subscriber.preferences.quietHours.start ||
                currentHour < subscriber.preferences.quietHours.end) {
                return false;
            }
        }

        return true;
    }

    checkRateLimit(channelName, recipient) {
        const limiter = this.rateLimiters.get(channelName);
        if (!limiter) {
            return true;
        }

        const key = `${channelName}:${recipient}`;
        const now = Date.now();

        if (!limiter.requests.has(key)) {
            limiter.requests.set(key, []);
        }

        const requests = limiter.requests.get(key);
        const windowStart = now - limiter.windowMs;

        // Remove old requests
        while (requests.length > 0 && requests[0] < windowStart) {
            requests.shift();
        }

        if (requests.length >= limiter.maxPerWindow) {
            return false;
        }

        requests.push(now);
        return true;
    }

    setupRateLimiter(channelName, config) {
        this.rateLimiters.set(channelName, {
            maxPerWindow: config.maxPerWindow,
            windowMs: config.windowMs,
            requests: new Map()
        });
    }

    markAsDelivered(notification) {
        notification.status = 'delivered';
        notification.deliveredAt = new Date();
        this.deliveryStats.successful++;
        this.deliveryStats.pending--;
    }

    markAsFailed(notification, reason) {
        notification.status = 'failed';
        notification.failedAt = new Date();
        notification.failureReason = reason;
        this.deliveryStats.failed++;
        this.deliveryStats.pending--;
    }

    async handleDeliveryFailure(notification, reason) {
        this.markAsFailed(notification, reason);

        // Check if we should retry
        if (notification.deliveryAttempts.length < this.maxRetries) {
            await this.scheduleRetry(notification);
        }
    }

    async scheduleRetry(notification) {
        const delay = Math.pow(2, notification.deliveryAttempts.length) * 1000; // Exponential backoff

        setTimeout(async () => {
            notification.status = 'retrying';
            await this.deliverNotification(notification);
        }, delay);
    }

    scheduleNotification(notification) {
        const delay = notification.scheduledFor.getTime() - Date.now();

        if (delay > 0) {
            const timeoutId = setTimeout(async () => {
                await this.deliverNotification(notification);
                this.scheduledNotifications.delete(notification.id);
            }, delay);

            this.scheduledNotifications.set(notification.id, timeoutId);
        } else {
            // Schedule time is in the past, deliver immediately
            this.deliverNotification(notification);
        }
    }

    cancelScheduledNotification(notificationId) {
        const timeoutId = this.scheduledNotifications.get(notificationId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.scheduledNotifications.delete(notificationId);
            return true;
        }
        return false;
    }

    // Notification Rules
    createRule(ruleId, ruleData) {
        const rule = {
            id: ruleId,
            name: ruleData.name,
            conditions: ruleData.conditions,
            actions: ruleData.actions,
            enabled: ruleData.enabled !== false,
            priority: ruleData.priority || 0,
            createdAt: new Date(),
            triggerCount: 0,
            lastTriggered: null
        };

        this.notificationRules.set(ruleId, rule);
        return rule;
    }

    evaluateRules(eventData) {
        const triggeredRules = [];

        for (const rule of this.notificationRules.values()) {
            if (!rule.enabled) continue;

            if (this.evaluateConditions(rule.conditions, eventData)) {
                triggeredRules.push(rule);
                rule.triggerCount++;
                rule.lastTriggered = new Date();
            }
        }

        // Sort by priority
        triggeredRules.sort((a, b) => b.priority - a.priority);

        return triggeredRules;
    }

    evaluateConditions(conditions, eventData) {
        for (const condition of conditions) {
            if (!this.evaluateCondition(condition, eventData)) {
                return false;
            }
        }
        return true;
    }

    evaluateCondition(condition, eventData) {
        const { field, operator, value } = condition;
        const fieldValue = this.getFieldValue(eventData, field);

        switch (operator) {
            case 'equals':
                return fieldValue === value;
            case 'not_equals':
                return fieldValue !== value;
            case 'greater_than':
                return fieldValue > value;
            case 'less_than':
                return fieldValue < value;
            case 'contains':
                return String(fieldValue).includes(String(value));
            case 'in':
                return Array.isArray(value) && value.includes(fieldValue);
            default:
                return false;
        }
    }

    getFieldValue(obj, fieldPath) {
        return fieldPath.split('.').reduce((current, key) => current?.[key], obj);
    }

    async executeRuleActions(rule, eventData) {
        for (const action of rule.actions) {
            await this.executeAction(action, eventData);
        }
    }

    async executeAction(action, eventData) {
        switch (action.type) {
            case 'send_notification':
                await this.sendNotification({
                    type: action.notificationType,
                    priority: action.priority,
                    category: action.category,
                    recipient: action.recipient || eventData.userId,
                    templateId: action.templateId,
                    variables: this.mergeVariables(action.variables, eventData),
                    channels: action.channels
                });
                break;

            case 'update_subscriber':
                if (action.preferenceUpdates) {
                    this.updateSubscriberPreferences(
                        eventData.userId,
                        action.preferenceUpdates
                    );
                }
                break;

            case 'trigger_webhook':
                await this.triggerWebhook(action.webhookUrl, action.webhookData, eventData);
                break;

            default:
                console.log(`Unknown action type: ${action.type}`);
        }
    }

    mergeVariables(actionVariables, eventData) {
        const variables = { ...actionVariables };

        // Replace event data variables
        for (const [key, value] of Object.entries(variables)) {
            if (typeof value === 'string' && value.startsWith('event.')) {
                const fieldPath = value.substring(6); // Remove 'event.'
                variables[key] = this.getFieldValue(eventData, fieldPath);
            }
        }

        return variables;
    }

    async triggerWebhook(url, webhookData, eventData) {
        const fetch = require('node-fetch');

        const payload = {
            ...webhookData,
            eventData: eventData,
            timestamp: new Date()
        };

        try {
            await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error('Webhook trigger failed:', error);
        }
    }

    // Event Processing
    async processEvent(eventType, eventData) {
        this.emit('event:received', eventType, eventData);

        // Evaluate rules
        const triggeredRules = this.evaluateRules(eventData);

        // Execute rule actions
        for (const rule of triggeredRules) {
            await this.executeRuleActions(rule, eventData);
        }

        this.emit('event:processed', eventType, eventData, triggeredRules);
        return triggeredRules;
    }

    // Bulk Operations
    async sendBulkNotifications(notifications) {
        const results = [];

        for (const notificationData of notifications) {
            try {
                const result = await this.sendNotification(notificationData);
                results.push({ success: true, notification: result });
            } catch (error) {
                results.push({ success: false, error: error.message, data: notificationData });
            }
        }

        return results;
    }

    async subscribeBulk(subscribers) {
        const results = [];

        for (const subscriberData of subscribers) {
            try {
                const subscriber = this.subscribe(subscriberData.userId, subscriberData.preferences);
                results.push({ success: true, subscriber: subscriber });
            } catch (error) {
                results.push({ success: false, error: error.message, data: subscriberData });
            }
        }

        return results;
    }

    // Archiving
    archiveOldNotifications() {
        if (!this.enableArchiving || this.notificationHistory.length < this.archiveThreshold) {
            return;
        }

        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        const recent = [];
        const archive = [];

        for (const notification of this.notificationHistory) {
            if (notification.createdAt < cutoffDate) {
                archive.push(notification);
            } else {
                recent.push(notification);
            }
        }

        this.notificationHistory = recent;
        this.archivedNotifications.push(...archive);

        // Keep only last 10 archive batches
        if (this.archivedNotifications.length > 10000) {
            this.archivedNotifications = this.archivedNotifications.slice(-10000);
        }

        this.emit('notifications:archived', archive.length);
    }

    // Statistics and Analytics
    getDeliveryStats(timeRange = null) {
        let notifications = this.notificationHistory;

        if (timeRange) {
            const cutoff = new Date(Date.now() - timeRange);
            notifications = notifications.filter(n => n.createdAt >= cutoff);
        }

        const stats = {
            total: notifications.length,
            delivered: notifications.filter(n => n.status === 'delivered').length,
            failed: notifications.filter(n => n.status === 'failed').length,
            pending: notifications.filter(n => n.status === 'pending').length,
            deliveryRate: 0,
            averageDeliveryTime: 0
        };

        if (stats.total > 0) {
            stats.deliveryRate = (stats.delivered / stats.total) * 100;
        }

        const deliveredNotifications = notifications.filter(n =>
            n.status === 'delivered' && n.deliveredAt && n.createdAt
        );

        if (deliveredNotifications.length > 0) {
            const totalDeliveryTime = deliveredNotifications.reduce((sum, n) =>
                sum + (n.deliveredAt.getTime() - n.createdAt.getTime()), 0
            );
            stats.averageDeliveryTime = totalDeliveryTime / deliveredNotifications.length;
        }

        return stats;
    }

    getChannelStats(channelName = null, timeRange = null) {
        if (channelName) {
            const channel = this.channels.get(channelName);
            return channel ? { ...channel.deliveryStats } : null;
        }

        const stats = {};
        for (const [name, channel] of this.channels.entries()) {
            stats[name] = { ...channel.deliveryStats };
        }
        return stats;
    }

    getSubscriberStats(userId = null) {
        if (userId) {
            const subscriber = this.subscribers.get(userId);
            if (!subscriber) return null;

            const notifications = this.notificationHistory.filter(n => n.recipient === userId);

            return {
                totalNotifications: notifications.length,
                delivered: notifications.filter(n => n.status === 'delivered').length,
                failed: notifications.filter(n => n.status === 'failed').length,
                categories: Array.from(subscriber.subscriptions.keys()),
                lastActivity: subscriber.lastActivity
            };
        }

        const stats = {};
        for (const subscriber of this.subscribers.values()) {
            if (subscriber.isActive) {
                const notifications = this.notificationHistory.filter(n => n.recipient === subscriber.userId);
                stats[subscriber.userId] = {
                    totalNotifications: notifications.length,
                    delivered: notifications.filter(n => n.status === 'delivered').length,
                    failed: notifications.filter(n => n.status === 'failed').length
                };
            }
        }
        return stats;
    }

    getTemplateStats(templateId = null) {
        if (templateId) {
            const template = this.templates.get(templateId);
            return template ? {
                usageCount: template.usageCount,
                lastUsed: template.lastUsed
            } : null;
        }

        const stats = {};
        for (const [id, template] of this.templates.entries()) {
            stats[id] = {
                usageCount: template.usageCount,
                lastUsed: template.lastUsed
            };
        }
        return stats;
    }

    // Cleanup and Maintenance
    cleanup() {
        this.archiveOldNotifications();

        // Clean up old rate limit data
        const cutoff = Date.now() - this.rateLimitWindow;
        for (const limiter of this.rateLimiters.values()) {
            for (const [key, requests] of limiter.requests.entries()) {
                const filtered = requests.filter(timestamp => timestamp > cutoff);
                if (filtered.length === 0) {
                    limiter.requests.delete(key);
                } else {
                    limiter.requests.set(key, filtered);
                }
            }
        }
    }

    // Export/Import
    exportConfiguration() {
        return {
            channels: Array.from(this.channels.entries()),
            templates: Array.from(this.templates.entries()),
            subscribers: Array.from(this.subscribers.entries()),
            rules: Array.from(this.notificationRules.entries()),
            config: {
                maxRetries: this.maxRetries,
                defaultChannel: this.defaultChannel,
                enableArchiving: this.enableArchiving,
                archiveThreshold: this.archiveThreshold,
                rateLimitWindow: this.rateLimitWindow,
                maxNotificationsPerWindow: this.maxNotificationsPerWindow
            }
        };
    }

    importConfiguration(data) {
        // Clear existing data
        this.channels.clear();
        this.templates.clear();
        this.subscribers.clear();
        this.notificationRules.clear();

        // Import channels
        for (const [name, channel] of data.channels) {
            this.channels.set(name, channel);
            this.setupRateLimiter(name, channel.rateLimit);
        }

        // Import templates
        for (const [id, template] of data.templates) {
            this.templates.set(id, template);
        }

        // Import subscribers
        for (const [id, subscriber] of data.subscribers) {
            this.subscribers.set(id, subscriber);
        }

        // Import rules
        for (const [id, rule] of data.rules) {
            this.notificationRules.set(id, rule);
        }

        // Import config
        const config = data.config;
        if (config) {
            this.maxRetries = config.maxRetries || this.maxRetries;
            this.defaultChannel = config.defaultChannel || this.defaultChannel;
            this.enableArchiving = config.enableArchiving || this.enableArchiving;
            this.archiveThreshold = config.archiveThreshold || this.archiveThreshold;
            this.rateLimitWindow = config.rateLimitWindow || this.rateLimitWindow;
            this.maxNotificationsPerWindow = config.maxNotificationsPerWindow || this.maxNotificationsPerWindow;
        }
    }

    // Utility Methods
    generateNotificationId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateAttemptId() {
        return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    cancelChannelRetries(channelName) {
        // Implementation would cancel pending retries for the channel
        console.log(`Cancelling retries for channel: ${channelName}`);
    }

    // Real-time features
    enableRealTime() {
        this.realTimeEnabled = true;
        return this;
    }

    broadcast(notificationData) {
        // Broadcast to all active subscribers
        const activeSubscribers = this.getActiveSubscribers();

        for (const subscriber of activeSubscribers) {
            this.sendNotification({
                ...notificationData,
                recipient: subscriber.userId
            });
        }
    }

    // WebSocket integration
    setupWebSocketSupport() {
        this.webSocketClients = new Map();
        return {
            addClient: (clientId, ws) => {
                this.webSocketClients.set(clientId, ws);
            },

            removeClient: (clientId) => {
                this.webSocketClients.delete(clientId);
            },

            sendToClient: (clientId, notification) => {
                const ws = this.webSocketClients.get(clientId);
                if (ws && ws.readyState === 1) { // OPEN
                    ws.send(JSON.stringify(notification));
                }
            },

            broadcastToClients: (notification) => {
                for (const [clientId, ws] of this.webSocketClients.entries()) {
                    if (ws.readyState === 1) {
                        ws.send(JSON.stringify(notification));
                    }
                }
            }
        };
    }

    // Advanced filtering
    createNotificationFilter(filterData) {
        return {
            id: `filter_${Date.now()}`,
            criteria: filterData.criteria,
            action: filterData.action, // 'allow', 'block', 'modify'
            priority: filterData.priority || 0,
            enabled: filterData.enabled !== false,
            createdAt: new Date(),

            evaluate: (notification) => {
                // Evaluate filter criteria
                return this.evaluateConditions(filterData.criteria, notification);
            }
        };
    }

    // Template inheritance
    createTemplateInheritance() {
        return {
            setParent: (childTemplateId, parentTemplateId) => {
                const child = this.templates.get(childTemplateId);
                const parent = this.templates.get(parentTemplateId);

                if (child && parent) {
                    child.parentId = parentTemplateId;
                    return true;
                }
                return false;
            },

            resolveTemplate: (templateId, variables = {}) => {
                const template = this.templates.get(templateId);
                if (!template) {
                    throw new Error(`Template '${templateId}' not found`);
                }

                let current = template;
                const resolved = {
                    subject: current.subject,
                    content: current.content,
                    variables: [...(current.variables || [])]
                };

                // Walk up the inheritance chain
                while (current.parentId) {
                    const parent = this.templates.get(current.parentId);
                    if (!parent) break;

                    // Merge variables
                    resolved.variables = [...resolved.variables, ...(parent.variables || [])];

                    current = parent;
                }

                // Render with merged variables
                return this.renderTemplate(templateId, variables);
            }
        };
    }

    // Queue management
    createQueueManager() {
        this.notificationQueue = [];
        this.processingQueue = false;

        return {
            enqueue: (notificationData) => {
                this.notificationQueue.push({
                    ...notificationData,
                    queuedAt: new Date(),
                    priority: notificationData.priority || 'normal'
                });
            },

            processQueue: async () => {
                if (this.processingQueue) return;

                this.processingQueue = true;

                try {
                    // Sort by priority
                    this.notificationQueue.sort((a, b) => {
                        const priorityOrder = { high: 3, normal: 2, low: 1 };
                        return priorityOrder[b.priority] - priorityOrder[a.priority];
                    });

                    while (this.notificationQueue.length > 0) {
                        const notificationData = this.notificationQueue.shift();
                        await this.sendNotification(notificationData);
                    }
                } finally {
                    this.processingQueue = false;
                }
            },

            getQueueStats: () => {
                return {
                    queued: this.notificationQueue.length,
                    processing: this.processingQueue,
                    priorities: this.notificationQueue.reduce((acc, item) => {
                        acc[item.priority] = (acc[item.priority] || 0) + 1;
                        return acc;
                    }, {})
                };
            }
        };
    }

    // Monitoring and alerts
    createMonitoringSystem() {
        this.alerts = [];
        this.monitoringEnabled = true;

        return {
            setThreshold: (metric, threshold, condition = 'above') => {
                // Set monitoring thresholds
                console.log(`Setting threshold for ${metric}: ${condition} ${threshold}`);
            },

            checkThresholds: () => {
                const stats = this.getDeliveryStats();

                if (stats.deliveryRate < 90) {
                    this.createAlert('Low delivery rate', `Delivery rate is ${stats.deliveryRate.toFixed(1)}%`);
                }

                if (stats.failed > stats.delivered) {
                    this.createAlert('High failure rate', 'More failed than delivered notifications');
                }
            },

            createAlert: (title, message) => {
                const alert = {
                    id: `alert_${Date.now()}`,
                    title: title,
                    message: message,
                    createdAt: new Date(),
                    acknowledged: false
                };

                this.alerts.push(alert);
                this.emit('alert:created', alert);
            },

            getActiveAlerts: () => {
                return this.alerts.filter(alert => !alert.acknowledged);
            },

            acknowledgeAlert: (alertId) => {
                const alert = this.alerts.find(a => a.id === alertId);
                if (alert) {
                    alert.acknowledged = true;
                    alert.acknowledgedAt = new Date();
                    return true;
                }
                return false;
            }
        };
    }

    // Integration helpers
    createIntegrationHelpers() {
        return {
            slackWebhook: (webhookUrl) => {
                return {
                    send: async (notification) => {
                        const fetch = require('node-fetch');

                        const payload = {
                            text: `${notification.type.toUpperCase()}: ${notification.subject}`,
                            attachments: [{
                                text: notification.content,
                                color: this.getPriorityColor(notification.priority)
                            }]
                        };

                        await fetch(webhookUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    }
                };
            },

            emailDigest: (frequency = 'daily') => {
                return {
                    schedule: () => {
                        const scheduleTime = frequency === 'daily' ? '09:00' : '09:00';
                        // Implementation would schedule digest emails
                        console.log(`Email digest scheduled for ${scheduleTime}`);
                    },

                    generateDigest: (userId) => {
                        const notifications = this.notificationHistory
                            .filter(n => n.recipient === userId)
                            .slice(-20); // Last 20 notifications

                        return {
                            subject: 'Notification Digest',
                            content: this.formatDigestContent(notifications),
                            type: 'html'
                        };
                    }
                };
            }
        };
    }

    getPriorityColor(priority) {
        const colors = {
            high: 'danger',
            normal: 'good',
            low: 'warning'
        };
        return colors[priority] || 'good';
    }

    formatDigestContent(notifications) {
        let content = '<h2>Recent Notifications</h2><ul>';

        for (const notification of notifications) {
            content += `<li><strong>${notification.type}:</strong> ${notification.subject || 'No subject'}</li>`;
        }

        content += '</ul>';
        return content;
    }

    // Final utility methods
    toJSON() {
        return this.exportConfiguration();
    }

    static fromJSON(data) {
        const system = new NotificationSystem(data.config);
        system.importConfiguration(data);
        return system;
    }

    destroy() {
        // Cancel all scheduled notifications
        for (const timeoutId of this.scheduledNotifications.values()) {
            clearTimeout(timeoutId);
        }

        this.channels.clear();
        this.templates.clear();
        this.subscribers.clear();
        this.notificationHistory = [];
        this.notificationRules.clear();
        this.removeAllListeners();
    }
}

module.exports = NotificationSystem;
