const express = require('express');
const InventoryService = require('../services/inventoryService');
const winston = require('winston');

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'inventory-service-routes.log' })
  ]
});

// Batch add items to inventory
router.post('/batch/add', (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    const result = InventoryService.batchAddItems(items);
    logger.info(`Batch add operation completed: ${result.successCount} successful, ${result.failedItems.length} failed`);
    
    res.json({
      success: true,
      message: 'Batch add operation completed',
      result
    });
  } catch (error) {
    logger.error(`Error in batch add route: ${error.message}`);
    res.status(500).json({ error: 'Failed to process batch add operation' });
  }
});

// Batch remove items from inventory
router.post('/batch/remove', (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    const result = InventoryService.batchRemoveItems(items);
    logger.info(`Batch remove operation completed: ${result.successCount} successful, ${result.failedItems.length} failed`);
    
    res.json({
      success: true,
      message: 'Batch remove operation completed',
      result
    });
  } catch (error) {
    logger.error(`Error in batch remove route: ${error.message}`);
    res.status(500).json({ error: 'Failed to process batch remove operation' });
  }
});

// Get inventory analytics
router.get('/analytics', (req, res) => {
  try {
    const analytics = InventoryService.getInventoryAnalytics();
    logger.info('Inventory analytics retrieved successfully');
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error(`Error getting inventory analytics: ${error.message}`);
    res.status(500).json({ error: 'Failed to get inventory analytics' });
  }
});

// Validate inventory integrity
router.get('/validate', (req, res) => {
  try {
    const validation = InventoryService.validateInventoryIntegrity();
    logger.info(`Inventory validation completed: ${validation.issues.length} issues, ${validation.warnings.length} warnings`);
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    logger.error(`Error validating inventory: ${error.message}`);
    res.status(500).json({ error: 'Failed to validate inventory' });
  }
});

// Get items needing restock
router.get('/restock', (req, res) => {
  try {
    const { threshold } = req.query;
    const customThreshold = threshold ? parseInt(threshold) : null;
    
    const itemsNeedingRestock = InventoryService.getItemsNeedingRestock(customThreshold);
    logger.info(`Retrieved ${itemsNeedingRestock.length} items needing restock`);
    
    res.json({
      success: true,
      data: {
        items: itemsNeedingRestock,
        count: itemsNeedingRestock.length,
        threshold: customThreshold || InventoryService.lowStockThreshold
      }
    });
  } catch (error) {
    logger.error(`Error getting items needing restock: ${error.message}`);
    res.status(500).json({ error: 'Failed to get items needing restock' });
  }
});

// Transfer items between locations
router.post('/transfer', (req, res) => {
  try {
    const { fromLocation, toLocation, items } = req.body;
    
    if (!fromLocation || !toLocation || !items || !Array.isArray(items)) {
      return res.status(400).json({ 
        error: 'fromLocation, toLocation, and items array are required' 
      });
    }

    const transferResult = InventoryService.transferItems(fromLocation, toLocation, items);
    logger.info(`Transfer operation completed: ${transferResult.transferredItems.length} successful, ${transferResult.failedItems.length} failed`);
    
    res.json({
      success: transferResult.success,
      message: transferResult.message,
      data: transferResult
    });
  } catch (error) {
    logger.error(`Error in transfer route: ${error.message}`);
    res.status(500).json({ error: 'Failed to process transfer operation' });
  }
});

// Get inventory summary
router.get('/summary', (req, res) => {
  try {
    const analytics = InventoryService.getInventoryAnalytics();
    const itemsNeedingRestock = InventoryService.getItemsNeedingRestock();
    const validation = InventoryService.validateInventoryIntegrity();
    
    const summary = {
      totalItems: analytics.totalItems,
      totalQuantity: analytics.totalQuantity,
      averageQuantity: analytics.averageQuantity,
      lowStockCount: analytics.lowStockItems.length,
      criticalStockCount: analytics.criticalStockItems.length,
      outOfStockCount: analytics.outOfStockItems.length,
      itemsNeedingRestock: itemsNeedingRestock.length,
      validationIssues: validation.issues.length,
      validationWarnings: validation.warnings.length,
      itemCategories: Object.keys(analytics.itemCategories).length
    };
    
    logger.info('Inventory summary retrieved successfully');
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error(`Error getting inventory summary: ${error.message}`);
    res.status(500).json({ error: 'Failed to get inventory summary' });
  }
});

// Health check for inventory service
router.get('/health', (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'inventory-service',
      version: '1.0.0'
    };
    
    res.json(health);
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message 
    });
  }
});

module.exports = { inventoryServiceRouter: router }; 