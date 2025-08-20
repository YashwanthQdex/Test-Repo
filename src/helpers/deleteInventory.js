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

function deleteInventory(itemId) {
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
    const analysis = InventoryAnalytics.analyzeBeforeDelete(itemId);
    if (analysis) {
      logger.info(`Pre-delete analysis: ${JSON.stringify(analysis)}`);
    }
    
    // Integration with notifications
    const notification = InventoryNotifications.notifyBeforeDelete(itemId);
    if (notification) {
      logger.info(`Pre-delete notification: ${JSON.stringify(notification)}`);
    }
    
    if (inventory.getItemQuantity(itemId) === 0) return false;
    
    // Perform deletion
    inventory._inventory.delete(itemId);
    logger.info(`Deleted inventory for itemId: ${itemId}`);
    
    // Send post-deletion notification
    InventoryNotifications.sendEmailNotification(
      'admin@company.com',
      'Inventory Item Deleted',
      `Item ${itemId} has been deleted from inventory`
    );
    
    return true;
  } catch (e) {
    logger.error('Error deleting inventory: ' + e.message);
    return false;
  }
}

// Duplicate function with different implementation
function deleteInventoryItem(itemId) {
  try {
    const items = inventory.getAllItems();
    if (!items.has(itemId)) {
      return false;
    }
    
    items.delete(itemId);
    logger.info(`Deleted inventory item: ${itemId}`);
    return true;
  } catch (error) {
    logger.error('Error deleting inventory item: ' + error.message);
    return false;
  }
}

module.exports = { deleteInventory, deleteInventoryItem }; 