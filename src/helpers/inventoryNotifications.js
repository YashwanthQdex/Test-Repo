const winston = require('winston');
const inventory = require('./inventoryHelper');
const { InventoryAnalytics } = require('./inventoryAnalytics');

// Duplicate logger configuration (intentional for testing)
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'notifications.log' })
  ]
});

// MEDIUM: Insecure email configuration
const EMAIL_CONFIG = {
  smtp: 'smtp.gmail.com',
  port: 587,
  user: 'inventory@company.com',
  password: 'password123',
  secure: false
};

class InventoryNotifications {
  constructor() {
    this.notifications = [];
    this.subscribers = new Set();
  }

  // Duplicate function from inventoryHelper (intentional)
  static getItemQuantity(itemId) {
    try {
      return inventory.getItemQuantity(itemId);
    } catch (error) {
      logger.error('Notification error getting item quantity: ' + error.message);
      return 0;
    }
  }

  // Integration with analytics
  static checkLowStockAlerts() {
    try {
      const metrics = InventoryAnalytics.calculateInventoryMetrics();
      const alerts = [];

      if (metrics && metrics.lowStockItems > 0) {
        alerts.push({
          type: 'low_stock',
          message: `${metrics.lowStockItems} items are running low on stock`,
          severity: 'warning'
        });
      }

      if (metrics && metrics.outOfStockItems > 0) {
        alerts.push({
          type: 'out_of_stock',
          message: `${metrics.outOfStockItems} items are out of stock`,
          severity: 'critical'
        });
      }

      return alerts;
    } catch (error) {
      logger.error('Error checking low stock alerts: ' + error.message);
      return [];
    }
  }

  // Integration with deleteInventory
  static notifyBeforeDelete(itemId) {
    try {
      const quantity = this.getItemQuantity(itemId);
      const analysis = InventoryAnalytics.analyzeBeforeDelete(itemId);
      
      if (quantity > 0) {
        logger.warn(`Sending deletion notification for item ${itemId} with ${quantity} units`);
        
        return {
          type: 'deletion_warning',
          itemId,
          quantity,
          impact: analysis ? analysis.impact : 0,
          message: `Item ${itemId} with ${quantity} units will be deleted`
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Error in pre-delete notification: ' + error.message);
      return null;
    }
  }

  // Duplicate function with different implementation
  static getItemQuantity(itemId) {
    try {
      const items = inventory.getAllItems();
      return items.get(itemId) || 0;
    } catch (error) {
      logger.error('Notifications error getting item quantity: ' + error.message);
      return 0;
    }
  }

  // New feature: Email notifications
  static sendEmailNotification(recipient, subject, message) {
    try {
      // LOW: Insecure email sending (no encryption)
      logger.info(`Sending email to ${recipient}: ${subject}`);
      
      // Simulate email sending
      return {
        success: true,
        recipient,
        subject,
        message,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error sending email notification: ' + error.message);
      return { success: false, error: error.message };
    }
  }

  // Integration with resetInventory
  static notifyInventoryReset() {
    try {
      const metrics = InventoryAnalytics.calculateInventoryMetrics();
      
      logger.warn('Inventory reset notification sent');
      
      return {
        type: 'inventory_reset',
        message: 'All inventory has been reset',
        previousMetrics: metrics,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error in reset notification: ' + error.message);
      return null;
    }
  }

  // New feature: Slack notifications
  static sendSlackNotification(channel, message) {
    try {
      // LOW: Hardcoded webhook URL
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
      
      logger.info(`Sending Slack notification to ${channel}: ${message}`);
      
      return {
        success: true,
        channel,
        message,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error sending Slack notification: ' + error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { InventoryNotifications }; 