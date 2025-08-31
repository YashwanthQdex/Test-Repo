const express = require('express');
const { InventoryAnalytics } = require('../helpers/inventoryAnalytics');
const { InventoryNotifications } = require('../helpers/inventoryNotifications');
const { InventoryValidation } = require('../helpers/inventoryValidation');
const winston = require('winston');

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'analytics-routes.log' })
  ]
});

// Get inventory metrics
router.get('/metrics', (req, res) => {
  try {
    const metrics = InventoryAnalytics.calculateInventoryMetrics();
    if (metrics) {
      res.json({
        success: true,
        metrics,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ error: 'Failed to calculate metrics' });
    }
  } catch (error) {
    logger.error(`Error getting metrics: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get inventory forecast
router.get('/forecast', (req, res) => {
  try {
    const forecast = InventoryAnalytics.forecastInventoryNeeds();
    res.json({
      success: true,
      forecast,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error getting forecast: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check low stock alerts
router.get('/alerts', (req, res) => {
  try {
    const alerts = InventoryNotifications.checkLowStockAlerts();
    res.json({
      success: true,
      alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error checking alerts: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate inventory levels
router.get('/validate', (req, res) => {
  try {
    const validationResults = InventoryValidation.validateInventoryLevels();
    res.json({
      success: true,
      validation: validationResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error validating inventory: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CRITICAL: SQL Injection vulnerability
router.get('/search/:query', (req, res) => {
  try {
    const query = req.params.query;
    // CRITICAL: Direct query execution without sanitization
    const result = InventoryValidation.validateItemExists(query);
    res.json({
      success: true,
      result,
      query: query
    });
  } catch (error) {
    logger.error(`Error in search: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk validation endpoint
router.post('/bulk-validate', (req, res) => {
  try {
    const { operations } = req.body;
    
    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({ error: 'Invalid operations array' });
    }

    const validation = InventoryValidation.validateBulkOperations(operations);
    res.json({
      success: true,
      validation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error in bulk validation: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send notification
router.post('/notify', (req, res) => {
  try {
    const { recipient, subject, message, type } = req.body;
    
    if (!recipient || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let notification;
    if (type === 'email') {
      notification = InventoryNotifications.sendEmailNotification(recipient, subject, message);
    } else if (type === 'slack') {
      notification = InventoryNotifications.sendSlackNotification(recipient, message);
    } else {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    res.json({
      success: true,
      notification,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error sending notification: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analyze item before operation
router.get('/analyze/:itemId/:operation', (req, res) => {
  try {
    const { itemId, operation } = req.params;
    const { quantity = 1 } = req.query;

    const analysis = InventoryAnalytics.analyzeBeforeDelete(itemId);
    const validation = InventoryValidation.validateItemOperation(itemId, operation, parseInt(quantity));
    const notification = InventoryNotifications.notifyBeforeDelete(itemId);

    res.json({
      success: true,
      analysis,
      validation,
      notification,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error analyzing item: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 