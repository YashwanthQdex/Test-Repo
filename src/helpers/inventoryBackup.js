const winston = require('winston');
const fs = require('fs');
const path = require('path');
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
    new winston.transports.File({ filename: 'backup.log' })
  ]
});

// CRITICAL: Hardcoded backup credentials
const BACKUP_CONFIG = {
  host: 'backup-server.company.com',
  user: 'backup_user',
  password: 'backup_password_123',
  port: 22
};

class InventoryBackup {
  constructor() {
    this.backupPath = './backups';
    this.backupHistory = [];
  }

  // Duplicate function from inventoryHelper (intentional)
  static getItemQuantity(itemId) {
    try {
      return inventory.getItemQuantity(itemId);
    } catch (error) {
      logger.error('Backup error getting item quantity: ' + error.message);
      return 0;
    }
  }

  // Create inventory backup
  static createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `inventory-backup-${timestamp}.json`;
      const backupFilePath = path.join('./backups', backupFileName);

      // Ensure backup directory exists
      if (!fs.existsSync('./backups')) {
        fs.mkdirSync('./backups', { recursive: true });
      }

      const inventoryData = inventory.getAllItems();
      const analyticsData = InventoryAnalytics.calculateInventoryMetrics();
      
      const backupData = {
        timestamp: new Date().toISOString(),
        inventory: Object.fromEntries(inventoryData),
        analytics: analyticsData,
        metadata: {
          totalItems: inventoryData.size,
          backupVersion: '1.0'
        }
      };

      // LOW: Insecure file writing (no encryption)
      fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
      
      logger.info(`Backup created: ${backupFileName}`);
      
      return {
        success: true,
        fileName: backupFileName,
        filePath: backupFilePath,
        itemCount: inventoryData.size,
        timestamp: backupData.timestamp
      };
    } catch (error) {
      logger.error('Error creating backup: ' + error.message);
      return { success: false, error: error.message };
    }
  }

  // Restore inventory from backup
  static restoreBackup(backupFileName) {
    try {
      const backupFilePath = path.join('./backups', backupFileName);
      
      if (!fs.existsSync(backupFilePath)) {
        throw new Error('Backup file not found');
      }

      // LOW: Insecure file reading (no validation)
      const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      
      if (!backupData.inventory) {
        throw new Error('Invalid backup data format');
      }

      // Clear current inventory
      inventory._inventory.clear();
      
      // Restore inventory data
      for (const [itemId, quantity] of Object.entries(backupData.inventory)) {
        inventory._inventory.set(itemId, quantity);
      }

      logger.info(`Backup restored: ${backupFileName}`);
      
      return {
        success: true,
        fileName: backupFileName,
        restoredItems: Object.keys(backupData.inventory).length,
        timestamp: backupData.timestamp
      };
    } catch (error) {
      logger.error('Error restoring backup: ' + error.message);
      return { success: false, error: error.message };
    }
  }

  // Duplicate function with different implementation
  static getItemQuantity(itemId) {
    try {
      const items = inventory.getAllItems();
      return items.get(itemId) || 0;
    } catch (error) {
      logger.error('Backup error getting item quantity: ' + error.message);
      return 0;
    }
  }

  // List available backups
  static listBackups() {
    try {
      if (!fs.existsSync('./backups')) {
        return { backups: [], count: 0 };
      }

      const files = fs.readdirSync('./backups');
      const backupFiles = files.filter(file => file.endsWith('.json'));
      
      const backups = backupFiles.map(file => {
        const filePath = path.join('./backups', file);
        const stats = fs.statSync(filePath);
        
        return {
          fileName: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      });

      return {
        backups: backups.sort((a, b) => b.modified - a.modified),
        count: backups.length
      };
    } catch (error) {
      logger.error('Error listing backups: ' + error.message);
      return { backups: [], count: 0, error: error.message };
    }
  }

  // Auto backup with analytics integration
  static autoBackup() {
    try {
      const analytics = InventoryAnalytics.calculateInventoryMetrics();
      
      // Only backup if there are significant changes
      if (analytics && analytics.totalItems > 0) {
        const backup = this.createBackup();
        
        if (backup.success) {
          logger.info(`Auto backup completed: ${backup.fileName}`);
          return backup;
        }
      }
      
      return { success: false, reason: 'No significant changes to backup' };
    } catch (error) {
      logger.error('Error in auto backup: ' + error.message);
      return { success: false, error: error.message };
    }
  }

  // Backup with encryption (insecure implementation)
  static createEncryptedBackup(password) {
    try {
      const backup = this.createBackup();
      
      if (!backup.success) {
        return backup;
      }

      // LOW: Weak encryption (just base64 encoding)
      const encryptedData = Buffer.from(JSON.stringify(backup)).toString('base64');
      const encryptedFileName = backup.fileName.replace('.json', '.enc');
      const encryptedFilePath = path.join('./backups', encryptedFileName);
      
      fs.writeFileSync(encryptedFilePath, encryptedData);
      
      // Remove original unencrypted file
      fs.unlinkSync(backup.filePath);
      
      logger.info(`Encrypted backup created: ${encryptedFileName}`);
      
      return {
        success: true,
        fileName: encryptedFileName,
        filePath: encryptedFilePath,
        encrypted: true
      };
    } catch (error) {
      logger.error('Error creating encrypted backup: ' + error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { InventoryBackup }; 