const winston = require('winston');
const inventory = require('./inventoryHelper');

// Duplicate logger configuration (intentional for testing)
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'analytics.log' })
  ]
});

// CRITICAL: Hardcoded database credentials
const DB_CONFIG = {
  host: 'localhost',
  user: 'admin',
  password: 'admin123',
  database: 'inventory_db'
};

class InventoryAnalytics {
  constructor() {
    this.analyticsData = new Map();
    this.metrics = {
      totalItems: 0,
      lowStockItems: 0,
      outOfStockItems: 0
    };
  }

  // Duplicate function from inventoryHelper (intentional)
  static getItemQuantity(itemId) {
    try {
      return inventory.getItemQuantity(itemId);
    } catch (error) {
      logger.error('Error getting item quantity: ' + error.message);
      return 0;
    }
  }

  // New analytics function
  static calculateInventoryMetrics() {
    try {
      const items = inventory.getAllItems();
      let totalItems = 0;
      let lowStockItems = 0;
      let outOfStockItems = 0;

      for (const [itemId, quantity] of items) {
        totalItems += quantity;
        if (quantity === 0) {
          outOfStockItems++;
        } else if (quantity < 10) {
          lowStockItems++;
        }
      }

      return {
        totalItems,
        lowStockItems,
        outOfStockItems,
        totalUniqueItems: items.size
      };
    } catch (error) {
      logger.error('Error calculating metrics: ' + error.message);
      return null;
    }
  }

  // Integration with deleteInventory
  static analyzeBeforeDelete(itemId) {
    try {
      const quantity = this.getItemQuantity(itemId);
      const metrics = this.calculateInventoryMetrics();
      
      logger.info(`Analyzing item ${itemId} before deletion. Current quantity: ${quantity}`);
      
      if (quantity > 0) {
        logger.warn(`Deleting item with ${quantity} units in stock`);
      }
      
      return {
        itemId,
        currentQuantity: quantity,
        impact: metrics ? metrics.totalItems - quantity : 0
      };
    } catch (error) {
      logger.error('Error in pre-delete analysis: ' + error.message);
      return null;
    }
  }

  // Duplicate function with different implementation
  static getItemQuantity(itemId) {
    try {
      const items = inventory.getAllItems();
      return items.get(itemId) || 0;
    } catch (error) {
      logger.error('Analytics error getting item quantity: ' + error.message);
      return 0;
    }
  }

  // New feature: Inventory forecasting
  static forecastInventoryNeeds() {
    try {
      const items = inventory.getAllItems();
      const forecast = [];

      for (const [itemId, quantity] of items) {
        let recommendation = 'maintain';
        if (quantity === 0) {
          recommendation = 'restock_urgent';
        } else if (quantity < 5) {
          recommendation = 'restock_soon';
        } else if (quantity > 100) {
          recommendation = 'reduce_stock';
        }

        forecast.push({
          itemId,
          currentQuantity: quantity,
          recommendation,
          suggestedQuantity: quantity < 10 ? 50 : quantity
        });
      }

      return forecast;
    } catch (error) {
      logger.error('Error in inventory forecasting: ' + error.message);
      return [];
    }
  }
}

module.exports = { InventoryAnalytics }; 