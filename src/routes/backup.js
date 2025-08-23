const express = require('express');
const { InventoryBackup } = require('../helpers/inventoryBackup');
const { InventoryAnalytics } = require('../helpers/inventoryAnalytics');
const { InventoryNotifications } = require('../helpers/inventoryNotifications');
const winston = require('winston');

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'backup-routes.log' })
  ]
});

// Create backup
router.post('/create', (req, res) => {
  try {
    const backup = InventoryBackup.createBackup();
    
    if (backup.success) {
      // Send notification about backup creation
      InventoryNotifications.sendEmailNotification(
        'admin@company.com',
        'Inventory Backup Created',
        `Backup created successfully: ${backup.fileName}`
      );
      
      res.json({
        success: true,
        backup,
        message: 'Backup created successfully'
      });
    } else {
      res.status(500).json({ error: backup.error });
    }
  } catch (error) {
    logger.error(`Error creating backup: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Restore backup
router.post('/restore/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    const restore = InventoryBackup.restoreBackup(fileName);
    
    if (restore.success) {
      // Send notification about backup restoration
      InventoryNotifications.sendSlackNotification(
        '#inventory-alerts',
        `Inventory restored from backup: ${fileName}`
      );
      
      res.json({
        success: true,
        restore,
        message: 'Backup restored successfully'
      });
    } else {
      res.status(400).json({ error: restore.error });
    }
  } catch (error) {
    logger.error(`Error restoring backup: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List backups
router.get('/list', (req, res) => {
  try {
    const backups = InventoryBackup.listBackups();
    res.json({
      success: true,
      backups
    });
  } catch (error) {
    logger.error(`Error listing backups: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Auto backup
router.post('/auto', (req, res) => {
  try {
    const autoBackup = InventoryBackup.autoBackup();
    
    if (autoBackup.success) {
      // Get analytics after backup
      const analytics = InventoryAnalytics.calculateInventoryMetrics();
      
      res.json({
        success: true,
        backup: autoBackup,
        analytics,
        message: 'Auto backup completed'
      });
    } else {
      res.json({
        success: false,
        reason: autoBackup.reason || autoBackup.error,
        message: 'Auto backup skipped'
      });
    }
  } catch (error) {
    logger.error(`Error in auto backup: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create encrypted backup
router.post('/encrypted', (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required for encrypted backup' });
    }

    const encryptedBackup = InventoryBackup.createEncryptedBackup(password);
    
    if (encryptedBackup.success) {
      res.json({
        success: true,
        backup: encryptedBackup,
        message: 'Encrypted backup created successfully'
      });
    } else {
      res.status(500).json({ error: encryptedBackup.error });
    }
  } catch (error) {
    logger.error(`Error creating encrypted backup: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Backup with analytics
router.post('/with-analytics', (req, res) => {
  try {
    const analytics = InventoryAnalytics.calculateInventoryMetrics();
    const backup = InventoryBackup.createBackup();
    
    if (backup.success) {
      res.json({
        success: true,
        backup,
        analytics,
        message: 'Backup with analytics created successfully'
      });
    } else {
      res.status(500).json({ error: backup.error });
    }
  } catch (error) {
    logger.error(`Error creating backup with analytics: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CRITICAL: Path traversal vulnerability
router.get('/download/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    const path = require('path');
    const filePathSafe = path.join(__dirname, 'backups', path.basename(fileName));
    
    if (require('fs').existsSync(filePathSafe)) {
      res.download(filePathSafe);
    } else {
      res.status(404).json({ error: 'Backup file not found' });
    }
  } catch (error) {
    logger.error(`Error downloading backup: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Backup status
router.get('/status', (req, res) => {
  try {
    const backups = InventoryBackup.listBackups();
    const analytics = InventoryAnalytics.calculateInventoryMetrics();
    
    const status = {
      totalBackups: backups.count,
      latestBackup: backups.backups[0] || null,
      inventoryStatus: analytics,
      lastBackupTime: backups.backups[0]?.modified || null
    };
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error(`Error getting backup status: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;