# Inventory Service - Advanced Features

This document describes the advanced inventory management features available in the inventory service.

## Overview

The inventory service provides enhanced inventory management capabilities including:
- Batch operations for adding/removing multiple items
- Inventory analytics and reporting
- Data integrity validation
- Restock management
- Item transfer between locations
- Comprehensive logging and monitoring

## Files Structure

```
inventory-service/
├── src/
│   ├── services/
│   │   └── inventoryService.js      # Core inventory service logic
│   ├── routes/
│   │   ├── inventory.js             # Basic inventory routes
│   │   └── inventoryService.js      # Advanced inventory service routes
│   └── helpers/
│       └── inventoryHelper.js       # Basic inventory helper functions
```

## API Endpoints

### Batch Operations

#### Batch Add Items
**POST** `/inventory-service/batch/add`

Add multiple items to inventory in a single operation.

**Request Body:**
```json
{
  "items": [
    { "itemId": "ITEM-001", "quantity": 10 },
    { "itemId": "ITEM-002", "quantity": 5 },
    { "itemId": "ITEM-003", "quantity": 15 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Batch add operation completed",
  "result": {
    "successCount": 3,
    "failedItems": [],
    "totalAdded": 30
  }
}
```

#### Batch Remove Items
**POST** `/inventory-service/batch/remove`

Remove multiple items from inventory in a single operation.

**Request Body:**
```json
{
  "items": [
    { "itemId": "ITEM-001", "quantity": 5 },
    { "itemId": "ITEM-002", "quantity": 2 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Batch remove operation completed",
  "result": {
    "successCount": 2,
    "failedItems": [],
    "totalRemoved": 7
  }
}
```

### Analytics & Reporting

#### Get Inventory Analytics
**GET** `/inventory-service/analytics`

Get comprehensive inventory analytics and statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalItems": 25,
    "totalQuantity": 1500,
    "lowStockItems": [
      { "itemId": "ITEM-005", "quantity": 8 }
    ],
    "criticalStockItems": [
      { "itemId": "ITEM-010", "quantity": 3 }
    ],
    "outOfStockItems": [
      { "itemId": "ITEM-015", "quantity": 0 }
    ],
    "averageQuantity": 60,
    "itemCategories": {
      "ITEM": {
        "count": 20,
        "totalQuantity": 1200
      },
      "TOOL": {
        "count": 5,
        "totalQuantity": 300
      }
    }
  }
}
```

#### Get Inventory Summary
**GET** `/inventory-service/summary`

Get a quick summary of inventory status.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalItems": 25,
    "totalQuantity": 1500,
    "averageQuantity": 60,
    "lowStockCount": 3,
    "criticalStockCount": 1,
    "outOfStockCount": 2,
    "itemsNeedingRestock": 6,
    "validationIssues": 0,
    "validationWarnings": 0,
    "itemCategories": 2
  }
}
```

### Data Validation

#### Validate Inventory Integrity
**GET** `/inventory-service/validate`

Check inventory data for integrity issues and warnings.

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "issues": [],
    "warnings": [
      {
        "itemId": "ITEM-020",
        "warning": "Unusually high quantity detected",
        "value": 1500000
      }
    ]
  }
}
```

### Restock Management

#### Get Items Needing Restock
**GET** `/inventory-service/restock?threshold=15`

Get items that need restocking based on threshold.

**Query Parameters:**
- `threshold` (optional): Custom threshold for low stock (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      { "itemId": "ITEM-005", "quantity": 8 },
      { "itemId": "ITEM-010", "quantity": 3 }
    ],
    "count": 2,
    "threshold": 15
  }
}
```

### Item Transfer

#### Transfer Items Between Locations
**POST** `/inventory-service/transfer`

Transfer items between different locations (placeholder for multi-location inventory).

**Request Body:**
```json
{
  "fromLocation": "WAREHOUSE-A",
  "toLocation": "WAREHOUSE-B",
  "items": [
    { "itemId": "ITEM-001", "quantity": 10 },
    { "itemId": "ITEM-002", "quantity": 5 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transfer completed successfully",
  "data": {
    "success": true,
    "transferredItems": [
      { "itemId": "ITEM-001", "quantity": 10 },
      { "itemId": "ITEM-002", "quantity": 5 }
    ],
    "failedItems": [],
    "message": "Transfer completed successfully"
  }
}
```

### Health Check

#### Service Health
**GET** `/inventory-service/health`

Check the health status of the inventory service.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "inventory-service",
  "version": "1.0.0"
}
```

## Configuration

### Stock Thresholds

The service uses configurable thresholds for stock management:

- **Low Stock Threshold**: 10 (default)
- **Critical Stock Threshold**: 5 (default)

These can be customized by modifying the `InventoryService` class constructor.

### Logging

The service generates detailed logs for all operations:

- `inventory-service.log` - Service operation logs
- `inventory-service-routes.log` - API route access logs

## Error Handling

All endpoints include comprehensive error handling:

- **400 Bad Request**: Invalid input parameters
- **500 Internal Server Error**: Service errors

Error responses include descriptive messages and are logged for debugging.

## Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

// Batch add items
const addItems = async () => {
  try {
    const response = await axios.post('/inventory-service/batch/add', {
      items: [
        { itemId: 'ITEM-001', quantity: 10 },
        { itemId: 'ITEM-002', quantity: 5 }
      ]
    });
    console.log('Batch add result:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};

// Get analytics
const getAnalytics = async () => {
  try {
    const response = await axios.get('/inventory-service/analytics');
    console.log('Analytics:', response.data.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};
```

### cURL Examples

```bash
# Batch add items
curl -X POST http://localhost:3000/inventory-service/batch/add \
  -H "Content-Type: application/json" \
  -d '{"items":[{"itemId":"ITEM-001","quantity":10}]}'

# Get analytics
curl http://localhost:3000/inventory-service/analytics

# Get items needing restock
curl "http://localhost:3000/inventory-service/restock?threshold=15"
```

## Integration

To integrate these routes into your main application, add the following to your main server file:

```javascript
const { inventoryServiceRouter } = require('./routes/inventoryService');

// Mount the inventory service routes
app.use('/inventory-service', inventoryServiceRouter);
```

## Security Considerations

- All endpoints validate input parameters
- Comprehensive error handling prevents information leakage
- Logging includes operation tracking for audit purposes
- Input sanitization prevents injection attacks

## Performance Notes

- Batch operations are optimized for handling multiple items efficiently
- Analytics are computed on-demand and cached where appropriate
- Validation operations are lightweight and fast
- All operations include proper error boundaries 