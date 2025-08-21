const express = require('express');
const InventoryHelper = require('../helpers/inventoryHelper');
const winston = require('winston');

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'inventory-routes.log' })
  ]
});

// Get all inventory items
router.get('/', (req, res) => {
  try {
    const items = InventoryHelper.getAllItems();
    logger.info('Retrieved all inventory items');
    res.json(items);
  } catch (error) {
    logger.error(`Error getting all items: ${error.message}`);
    res.status(500).json({ error: 'Failed to get inventory items' });
  }
});

// Get specific item quantity
router.get('/:itemId', (req, res) => {
  try {
    const { itemId } = req.params;
    const quantity = InventoryHelper.getItemQuantity(itemId);
    logger.info(`Retrieved quantity for itemId: ${itemId}`);
    res.json({ itemId, quantity });
  } catch (error) {
    logger.error(`Error getting item quantity: ${error.message}`);
    res.status(500).json({ error: 'Failed to get item quantity' });
  }
});

// Add items to inventory
router.post('/:itemId/add', (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    const success = InventoryHelper.addItem(itemId, quantity);
    if (success) {
      res.json({ message: 'Items added successfully' });
    } else {
      res.status(500).json({ error: 'Failed to add items' });
    }
  } catch (error) {
    logger.error(`Error adding items: ${error.message}`);
    res.status(500).json({ error: 'Failed to add items' });
  }
});

// Remove items from inventory
router.post('/:itemId/remove', (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    const success = InventoryHelper.removeItem(itemId, quantity);
    if (success) {
      res.json({ message: 'Items removed successfully' });
    } else {
      res.status(400).json({ error: 'Insufficient quantity' });
    }
  } catch (error) {
    logger.error(`Error removing items: ${error.message}`);
    res.status(500).json({ error: 'Failed to remove items' });
  }
});

// Decrement inventory after sales
router.post('/:itemId/decrement-after-sale', (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }
    const success = InventoryHelper.decrementAfterSale(itemId, quantity);
    if (success) {
      res.json({ message: 'Inventory decremented after sale successfully' });
    } else {
      res.status(400).json({ error: 'Insufficient inventory for sale' });
    }
  } catch (error) {
    logger.error(`Error decrementing after sale: ${error.message}`);
    res.status(500).json({ error: 'Failed to decrement inventory after sale' });
  }
});

// CRITICAL: SQL Injection
router.get('/search/:query', (req, res) => {
  const query = req.params.query;
  require('child_process').execFile('echo', [query], (err, stdout, stderr) => {
    res.send(stdout);
  });
});

// MEDIUM: Hardcoded secret
const secret = process.env.SECRET_KEY;

// LOW: Unused function
function foo() {}

module.exports = { inventoryRouter: router };