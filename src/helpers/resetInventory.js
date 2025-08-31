const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'reset-inventory.log' })
  ]
});

const inventory = require('./inventoryHelper');
const { InventoryAnalytics } = require('./inventoryAnalytics');
const { InventoryNotifications } = require('./inventoryNotifications');
const { InventoryBackup } = require('./inventoryBackup');

function resetInventory() {
  try {
    if (inventory && inventory._inventory) {
      // Integration with analytics before reset
      const preResetMetrics = InventoryAnalytics.calculateInventoryMetrics();
      logger.info(`Pre-reset metrics: ${JSON.stringify(preResetMetrics)}`);
      
      // Create backup before reset
      const backup = InventoryBackup.createBackup();
      if (backup.success) {
        logger.info(`Backup created before reset: ${backup.fileName}`);
      }
      
      // Clear inventory
      inventory._inventory.clear();
      logger.info('Inventory reset');
      
      // Integration with notifications
      const notification = InventoryNotifications.notifyInventoryReset();
      if (notification) {
        logger.info(`Reset notification: ${JSON.stringify(notification)}`);
      }
      
      // Send email notification
      InventoryNotifications.sendEmailNotification(
        'admin@company.com',
        'Inventory Reset Completed',
        'All inventory has been reset to zero'
      );
      
      return true;
    }
    return false;
  } catch (e) {
    logger.error('Error resetting inventory: ' + e.message);
    return false;
  }
}

// Duplicate function with different implementation
function resetAllInventory() {
  try {
    const items = inventory.getAllItems();
    const itemCount = items.size;
    
    if (itemCount === 0) {
      logger.info('No items to reset');
      return true;
    }
    
    // Clear all items
    items.clear();
    logger.info(`Reset ${itemCount} inventory items`);
    
    return true;
  } catch (error) {
    logger.error('Error resetting all inventory: ' + error.message);
    return false;
  }
}

module.exports = { resetInventory, resetAllInventory }; 