const winston = require('winston');
const InventoryHelper = require('../helpers/inventoryHelper');

// Configure logger for the service
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'inventory-service.log' })
  ]
});

class InventoryService {
  constructor() {
    this.lowStockThreshold = 10;
    this.criticalStockThreshold = 5;
  }

  /**
   * Add multiple items to inventory in a single operation
   * @param {Array} items - Array of objects with itemId and quantity
   * @returns {Object} - Result with success count and failed items
   */
  static batchAddItems(items) {
    const results = {
      successCount: 0,
      failedItems: [],
      totalAdded: 0
    };

    if (!Array.isArray(items) || items.length === 0) {
      logger.warn('Batch add items called with invalid or empty array');
      return results;
    }

    items.forEach(item => {
      try {
        if (!item.itemId || !item.quantity || item.quantity <= 0) {
          results.failedItems.push({
            itemId: item.itemId,
            reason: 'Invalid item data'
          });
          return;
        }

        const success = InventoryHelper.addItem(item.itemId, item.quantity);
        if (success) {
          results.successCount++;
          results.totalAdded += item.quantity;
          logger.info(`Batch added ${item.quantity} items for itemId: ${item.itemId}`);
        } else {
          results.failedItems.push({
            itemId: item.itemId,
            reason: 'Add operation failed'
          });
        }
      } catch (error) {
        logger.error(`Error in batch add for itemId ${item.itemId}: ${error.message}`);
        results.failedItems.push({
          itemId: item.itemId,
          reason: error.message
        });
      }
    });

    logger.info(`Batch add completed: ${results.successCount} successful, ${results.failedItems.length} failed`);
    return results;
  }

  /**
   * Remove multiple items from inventory in a single operation
   * @param {Array} items - Array of objects with itemId and quantity
   * @returns {Object} - Result with success count and failed items
   */
  static batchRemoveItems(items) {
    const results = {
      successCount: 0,
      failedItems: [],
      totalRemoved: 0
    };

    if (!Array.isArray(items) || items.length === 0) {
      logger.warn('Batch remove items called with invalid or empty array');
      return results;
    }

    items.forEach(item => {
      try {
        if (!item.itemId || !item.quantity || item.quantity <= 0) {
          results.failedItems.push({
            itemId: item.itemId,
            reason: 'Invalid item data'
          });
          return;
        }

        const success = InventoryHelper.removeItem(item.itemId, item.quantity);
        if (success) {
          results.successCount++;
          results.totalRemoved += item.quantity;
          logger.info(`Batch removed ${item.quantity} items for itemId: ${item.itemId}`);
        } else {
          results.failedItems.push({
            itemId: item.itemId,
            reason: 'Insufficient quantity or operation failed'
          });
        }
      } catch (error) {
        logger.error(`Error in batch remove for itemId ${item.itemId}: ${error.message}`);
        results.failedItems.push({
          itemId: item.itemId,
          reason: error.message
        });
      }
    });

    logger.info(`Batch remove completed: ${results.successCount} successful, ${results.failedItems.length} failed`);
    return results;
  }

  /**
   * Get inventory analytics and statistics
   * @returns {Object} - Inventory analytics data
   */
  static getInventoryAnalytics() {
    try {
      const allItems = InventoryHelper.getAllItems();
      
      const analytics = {
        totalItems: allItems.length,
        totalQuantity: 0,
        lowStockItems: [],
        criticalStockItems: [],
        outOfStockItems: [],
        averageQuantity: 0,
        itemCategories: {}
      };

      if (allItems.length === 0) {
        return analytics;
      }

      allItems.forEach(item => {
        analytics.totalQuantity += item.quantity;
        
        // Categorize items by stock level
        if (item.quantity === 0) {
          analytics.outOfStockItems.push(item);
        } else if (item.quantity <= this.criticalStockThreshold) {
          analytics.criticalStockItems.push(item);
        } else if (item.quantity <= this.lowStockThreshold) {
          analytics.lowStockItems.push(item);
        }

        // Categorize by item type (assuming itemId format: TYPE-XXX)
        const itemType = item.itemId.split('-')[0] || 'UNKNOWN';
        if (!analytics.itemCategories[itemType]) {
          analytics.itemCategories[itemType] = {
            count: 0,
            totalQuantity: 0
          };
        }
        analytics.itemCategories[itemType].count++;
        analytics.itemCategories[itemType].totalQuantity += item.quantity;
      });

      analytics.averageQuantity = analytics.totalQuantity / analytics.totalItems;

      logger.info(`Inventory analytics generated: ${analytics.totalItems} items, ${analytics.totalQuantity} total quantity`);
      return analytics;
    } catch (error) {
      logger.error(`Error generating inventory analytics: ${error.message}`);
      throw new Error('Failed to generate inventory analytics');
    }
  }

  /**
   * Validate inventory data integrity
   * @returns {Object} - Validation results
   */
  static validateInventoryIntegrity() {
    const validation = {
      isValid: true,
      issues: [],
      warnings: []
    };

    try {
      const allItems = InventoryHelper.getAllItems();
      
      allItems.forEach(item => {
        // Check for negative quantities
        if (item.quantity < 0) {
          validation.isValid = false;
          validation.issues.push({
            itemId: item.itemId,
            issue: 'Negative quantity detected',
            value: item.quantity
          });
        }

        // Check for extremely high quantities (potential data corruption)
        if (item.quantity > 1000000) {
          validation.warnings.push({
            itemId: item.itemId,
            warning: 'Unusually high quantity detected',
            value: item.quantity
          });
        }

        // Check for invalid item IDs
        if (!item.itemId || item.itemId.trim() === '') {
          validation.isValid = false;
          validation.issues.push({
            itemId: item.itemId,
            issue: 'Empty or invalid item ID'
          });
        }
      });

      logger.info(`Inventory validation completed: ${validation.issues.length} issues, ${validation.warnings.length} warnings`);
      return validation;
    } catch (error) {
      logger.error(`Error validating inventory integrity: ${error.message}`);
      validation.isValid = false;
      validation.issues.push({
        issue: 'Validation process failed',
        error: error.message
      });
      return validation;
    }
  }

  /**
   * Get items that need restocking based on thresholds
   * @param {number} threshold - Custom threshold for low stock
   * @returns {Array} - Items that need restocking
   */
  static getItemsNeedingRestock(threshold = null) {
    try {
      const stockThreshold = threshold || this.lowStockThreshold;
      const allItems = InventoryHelper.getAllItems();
      
      const itemsNeedingRestock = allItems.filter(item => 
        item.quantity <= stockThreshold
      );

      logger.info(`Found ${itemsNeedingRestock.length} items needing restock (threshold: ${stockThreshold})`);
      return itemsNeedingRestock;
    } catch (error) {
      logger.error(`Error getting items needing restock: ${error.message}`);
      throw new Error('Failed to get items needing restock');
    }
  }

  /**
   * Transfer items between locations (if implementing multi-location inventory)
   * @param {string} fromLocation - Source location
   * @param {string} toLocation - Destination location
   * @param {Array} items - Items to transfer
   * @returns {Object} - Transfer results
   */
  static transferItems(fromLocation, toLocation, items) {
    const transferResult = {
      success: false,
      transferredItems: [],
      failedItems: [],
      message: ''
    };

    try {
      if (!fromLocation || !toLocation || !items || items.length === 0) {
        transferResult.message = 'Invalid transfer parameters';
        return transferResult;
      }

      // For now, this is a placeholder for multi-location inventory
      // In a real implementation, you would have separate inventory stores per location
      logger.info(`Transfer initiated from ${fromLocation} to ${toLocation} for ${items.length} items`);
      
      // Simulate transfer process
      items.forEach(item => {
        const removeSuccess = InventoryHelper.removeItem(item.itemId, item.quantity);
        if (removeSuccess) {
          // In a real implementation, you would add to the destination location
          // For now, we'll just add back to the same inventory
          const addSuccess = InventoryHelper.addItem(item.itemId, item.quantity);
          if (addSuccess) {
            transferResult.transferredItems.push(item);
          } else {
            transferResult.failedItems.push({
              ...item,
              reason: 'Failed to add to destination'
            });
          }
        } else {
          transferResult.failedItems.push({
            ...item,
            reason: 'Failed to remove from source'
          });
        }
      });

      transferResult.success = transferResult.failedItems.length === 0;
      transferResult.message = transferResult.success 
        ? 'Transfer completed successfully' 
        : `Transfer completed with ${transferResult.failedItems.length} failures`;

      logger.info(`Transfer completed: ${transferResult.transferredItems.length} successful, ${transferResult.failedItems.length} failed`);
      return transferResult;
    } catch (error) {
      logger.error(`Error during item transfer: ${error.message}`);
      transferResult.message = 'Transfer process failed';
      return transferResult;
    }
  }
}

module.exports = InventoryService; 