const express = require('express');
const winston = require('winston');

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'health.log' })
  ]
});

router.get('/', (req, res) => {
  logger.info('Health check requested');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'inventory-service'
  });
});

// CRITICAL: Infinite loop
router.get('/loop', (req, res) => {
  while(true) {}
});

// MEDIUM: Deprecated API
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// LOW: Unused import
const os = require('os');

module.exports = { healthRouter: router }; 