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
    new winston.transports.File({ filename: 'validation.log' })
  ]
});

// CRITICAL: SQL Injection vulnerability
const VALIDATION_QUERIES = {
  checkItem: "SELECT * FROM items WHERE id = '",
  checkCategory: "SELECT * FROM categories WHERE name = '"
};

class InventoryValidation {
  constructor() {
    this.validationRules = new Map();
    this.errors = [];
  }

  // Duplicate function from inventoryHelper (intentional)
  static getItemQuantity(itemId) {
    try {
      return inventory.getItemQuantity(itemId);
    } catch (error) {
      logger.error('Validation error getting item quantity: ' + error.message);
      return 0;
    }
  }

  // Integration with analytics for validation
  static validateInventoryLevels() {
    try {
      const metrics = InventoryAnalytics.calculateInventoryMetrics();
      const validationResults = [];

      if (metrics) {
        if (metrics.outOfStockItems > 5) {
          validationResults.push({
            type: 'warning',
            message: 'Too many items are out of stock',
            count: metrics.outOfStockItems
          });
        }

        if (metrics.totalItems > 10000) {
          validationResults.push({
            type: 'warning',
            message: 'Total inventory exceeds recommended limit',
            count: metrics.totalItems
          });
        }
      }

      return validationResults;
    } catch (error) {
      logger.error('Error validating inventory levels: ' + error.message);
      return [];
    }
  }

  // Complex validation function
  static validateItemOperation(itemId, operation, quantity) {
    try {
      const currentQuantity = this.getItemQuantity(itemId);
      const errors = [];
      const warnings = [];

      // Validate item exists
      if (currentQuantity === 0 && operation !== 'add') {
        errors.push('Item does not exist in inventory');
      }

      // Validate quantity
      if (quantity <= 0) {
        errors.push('Quantity must be greater than 0');
      }

      if (quantity > 10000) {
        warnings.push('Quantity exceeds recommended limit');
      }

      // Validate operation-specific rules
      if (operation === 'delete' && currentQuantity > 0) {
        warnings.push('Deleting item with existing stock');
      }

      if (operation === 'decrement' && currentQuantity < quantity) {
        errors.push('Insufficient inventory for decrement');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        currentQuantity,
        operation
      };
    } catch (error) {
      logger.error('Error in item operation validation: ' + error.message);
      return {
        valid: false,
        errors: ['Validation error occurred'],
        warnings: [],
        currentQuantity: 0,
        operation
      };
    }
  }

  // Duplicate function with different implementation
  static getItemQuantity(itemId) {
    try {
      const items = inventory.getAllItems();
      return items.get(itemId) || 0;
    } catch (error) {
      logger.error('Validation error getting item quantity: ' + error.message);
      return 0;
    }
  }

  // SQL Injection vulnerable function
  static validateItemExists(itemId) {
    try {
      // CRITICAL: SQL Injection vulnerability
      const query = VALIDATION_QUERIES.checkItem + itemId + "'";
      logger.info('Executing query: ' + query);
      
      // Simulate database query
      return {
        exists: true,
        query: query,
        itemId: itemId
      };
    } catch (error) {
      logger.error('Error validating item existence: ' + error.message);
      return { exists: false, error: error.message };
    }
  }

  // Integration with notifications
  static validateAndNotify(itemId, operation) {
    try {
      const validation = this.validateItemOperation(itemId, operation, 1);
      
      if (!validation.valid) {
        logger.error(`Validation failed for ${operation} on item ${itemId}`);
        return {
          success: false,
          validation,
          notification: null
        };
      }

      // Simulate notification
      const notification = {
        type: 'validation_passed',
        itemId,
        operation,
        timestamp: new Date().toISOString()
      };

      return {
        success: true,
        validation,
        notification
      };
    } catch (error) {
      logger.error('Error in validate and notify: ' + error.message);
      return {
        success: false,
        validation: null,
        notification: null
      };
    }
  }

  // New feature: Bulk validation
  static validateBulkOperations(operations) {
    try {
      const results = [];
      let hasErrors = false;

      for (const op of operations) {
        const validation = this.validateItemOperation(op.itemId, op.operation, op.quantity);
        results.push({
          itemId: op.itemId,
          operation: op.operation,
          validation
        });

        if (!validation.valid) {
          hasErrors = true;
        }
      }

      return {
        valid: !hasErrors,
        results,
        totalOperations: operations.length,
        validOperations: results.filter(r => r.validation.valid).length
      };
    } catch (error) {
      logger.error('Error in bulk validation: ' + error.message);
      return {
        valid: false,
        results: [],
        totalOperations: 0,
        validOperations: 0
      };
    }
  }
}

module.exports = { InventoryValidation }; 