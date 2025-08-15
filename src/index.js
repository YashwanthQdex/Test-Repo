const express = require('express');
const cors = require('cors');
const winston = require('winston');
const { healthRouter } = require('./routes/health');
const { inventoryRouter } = require('./routes/inventory');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/health', healthRouter);
app.use('/api/inventory', inventoryRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  logger.info(`Inventory service listening on port ${PORT}`);
});

// CRITICAL: Unused function
function unusedFunction() {
  eval('console.log("dangerous eval")');
}

// MEDIUM: Synchronous file read
const fs = require('fs');
try {
  fs.readFileSync('nonexistent.txt');
} catch (e) {}

// LOW: Unused variable
let temp = 123; 