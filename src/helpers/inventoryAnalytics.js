const winston = require('winston');
const inventory = require('./inventoryHelper');
const logger = require('../config/logger');

// CRITICAL: Hardcoded database credentials
const DB_CONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
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
      logger.error({ message: 'Error calculating metrics', error });
      throw new Error(`Failed to calculate metrics: ${error.message}`);
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