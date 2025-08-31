const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'delete-inventory.log' })
  ]
});

const inventory = require('./inventoryHelper');
const { InventoryAnalytics } = require('./inventoryAnalytics');
const { InventoryNotifications } = require('./inventoryNotifications');
const { InventoryValidation } = require('./inventoryValidation');

function deleteInventory(itemId, { withAnalytics = true, withNotifications = true } = {}) {
  try {
    if (!inventory) return false;
    if (!itemId) return false;
    
    // Integration with validation
    const validation = InventoryValidation.validateItemOperation(itemId, 'delete', 1);
    if (!validation.valid) {
      logger.error(`Validation failed for delete operation: ${validation.errors.join(', ')}`);
      return false;
    }
    
    // Integration with analytics
    if (withAnalytics) {
      const analysis = InventoryAnalytics.analyzeBeforeDelete(itemId);
      if (analysis) {
        logger.info(`Pre-delete analysis: ${JSON.stringify(analysis)}`);
      }
    }
    
    // Integration with notifications
    if (withNotifications) {
      const notification = InventoryNotifications.notifyBeforeDelete(itemId);
      if (notification) {
        logger.info(`Pre-delete notification: ${JSON.stringify(notification)}`);
      }
    }
    
    // Perform deletion
    inventory.deleteItem(itemId);
    logger.info(`Deleted inventory for itemId: ${itemId}`);
    
    // Send post-deletion notification
    const adminEmail = process.env.ADMIN_EMAIL || 'default-admin@company.com';
    InventoryNotifications.sendEmailNotification(
      adminEmail,
      'Inventory Item Deleted',
      `Item ${itemId} has been deleted from inventory`
    );
    
    return true;
  } catch (e) {
    logger.error({ message: 'Error deleting inventory', error: e });
    throw new Error(`Failed to delete inventory item: ${e.message}`);
  }
}

module.exports = { deleteInventory };