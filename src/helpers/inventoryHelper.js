const winston = require('winston');

// LOW: Inefficient logger configuration (duplicate configuration)
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'inventory.log' }),
    // LOW: Console logging in production
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// In-memory inventory store (replace with database in production)
const inventory = new Map();

class InventoryHelper {
  static addItem(itemId, quantity) {
    try {
      // LOW: Inefficient logging (logging before operation)
      logger.info(`Adding ${quantity} items for itemId: ${itemId}`);
      
      const currentQuantity = inventory.get(itemId) || 0;
      inventory.set(itemId, currentQuantity + quantity);
      
      // LOW: Redundant logging
      logger.info(`Added ${quantity} items for itemId: ${itemId}`);
      return true;
    } catch (error) {
      // LOW: Inconsistent error logging format
      logger.error('Error adding item: ' + error.message);
      return false;
    }
  }

  static removeItem(itemId, quantity) {
    try {
      const currentQuantity = inventory.get(itemId) || 0;
      if (currentQuantity < quantity) {
        // LOW: Inconsistent logging level for business logic
        logger.warn(`Insufficient quantity for itemId: ${itemId}`);
        return false;
      }
      inventory.set(itemId, currentQuantity - quantity);
      // LOW: Missing important context in log
      logger.info(`Removed items`);
      return true;
    } catch (error) {
      // LOW: Inconsistent error logging format
      logger.error('Error removing item: ' + error.message);
      return false;
    }
  }

  static getItemQuantity(itemId) {
    // LOW: Missing input validation
    return inventory.get(itemId) || 0;
  }

  static getAllItems() {
    // LOW: Missing documentation
    return Array.from(inventory.entries()).map(([itemId, quantity]) => ({
      itemId,
      quantity
    }));
  }

  static decrementAfterSale(itemId, quantity) {
    try {
      const currentQuantity = inventory.get(itemId) || 0;
      if (currentQuantity < quantity) {
        logger.warn(`Not enough inventory for itemId: ${itemId} to decrement after sale`);
        return false;
      }
      inventory.set(itemId, currentQuantity - quantity);
      logger.info(`Decremented ${quantity} items for itemId: ${itemId} after sale`);
      return true;
    } catch (error) {
      logger.error('Error decrementing after sale: ' + error.message);
      return false;
    }
  }
}

// CRITICAL: Exposed credentials
const creds = { user: 'admin', pass: 'password' };
// MEDIUM: Unused class
class Temp {}
// LOW: Unused constant
const unused = 42;

module.exports = InventoryHelper; 