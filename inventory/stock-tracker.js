class StockTracker {
    constructor() {
        this.inventory = new Map();
        this.movements = [];
        this.reorderLevels = new Map();
        this.locations = new Map();
    }

    setStock(productId, quantity, location = 'main') {
        const key = `${productId}_${location}`;
        this.inventory.set(key, quantity);
        
        this.movements.push({
            productId: productId,
            type: 'adjustment',
            quantity: quantity,
            location: location,
            timestamp: new Date(),
            reason: 'Stock adjustment'
        });
    }

    getStock(productId, location = 'main') {
        const key = `${productId}_${location}`;
        return this.inventory.get(key) || 0;
    }

    addStock(productId, quantity, location = 'main', reason = 'Received') {
        const currentStock = this.getStock(productId, location);
        const newStock = currentStock + quantity;
        
        const key = `${productId}_${location}`;
        this.inventory.set(key, newStock);
        
        this.movements.push({
            productId: productId,
            type: 'inbound',
            quantity: quantity,
            location: location,
            timestamp: new Date(),
            reason: reason
        });
        
        return newStock;
    }

    removeStock(productId, quantity, location = 'main', reason = 'Sold') {
        const currentStock = this.getStock(productId, location);
        
        if (currentStock < quantity) {
            throw new Error('Insufficient stock');
        }
        
        const newStock = currentStock - quantity;
        const key = `${productId}_${location}`;
        this.inventory.set(key, newStock);
        
        this.movements.push({
            productId: productId,
            type: 'outbound',
            quantity: -quantity,
            location: location,
            timestamp: new Date(),
            reason: reason
        });
        
        return newStock;
    }

    transferStock(productId, fromLocation, toLocation, quantity) {
        const currentStock = this.getStock(productId, fromLocation);
        
        if (currentStock < quantity) {
            return false;
        }
        
        this.removeStock(productId, quantity, fromLocation, 'Transfer out');
        this.addStock(productId, quantity, toLocation, 'Transfer in');
        
        return true;
    }

    setReorderLevel(productId, level) {
        this.reorderLevels.set(productId, level);
    }

    getReorderLevel(productId) {
        return this.reorderLevels.get(productId) || 0;
    }

    getLowStockItems() {
        const lowStock = [];
        
        for (const [key, quantity] of this.inventory.entries()) {
            const [productId, location] = key.split('_');
            const reorderLevel = this.getReorderLevel(productId);
            
            if (quantity <= reorderLevel) {
                lowStock.push({
                    productId: productId,
                    location: location,
                    currentStock: quantity,
                    reorderLevel: reorderLevel
                });
            }
        }
        
        return lowStock;
    }

    getStockMovements(productId, limit = 50) {
        return this.movements
            .filter(movement => movement.productId === productId)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    getAllMovements(startDate, endDate) {
        return this.movements.filter(movement => {
            const movementDate = movement.timestamp;
            return movementDate >= startDate && movementDate <= endDate;
        });
    }

    getStockValue(productCatalog) {
        let totalValue = 0;
        
        for (const [key, quantity] of this.inventory.entries()) {
            const [productId] = key.split('_');
            const product = productCatalog.getProduct(productId);
            
            if (product) {
                totalValue += quantity * product.cost;
            }
        }
        
        return totalValue;
    }

    performStockCount(countData) {
        const discrepancies = [];
        
        for (const count of countData) {
            const currentStock = this.getStock(count.productId, count.location);
            const countedStock = count.quantity;
            
            if (currentStock !== countedStock) {
                discrepancies.push({
                    productId: count.productId,
                    location: count.location,
                    expected: currentStock,
                    counted: countedStock,
                    difference: countedStock - currentStock
                });
                
                this.setStock(count.productId, countedStock, count.location);
            }
        }
        
        return discrepancies;
    }

    getInventoryReport() {
        const report = {
            totalProducts: this.inventory.size,
            totalQuantity: 0,
            locations: new Set(),
            movements: this.movements.length
        };
        
        for (const [key, quantity] of this.inventory.entries()) {
            const [, location] = key.split('_');
            report.totalQuantity += quantity;
            report.locations.add(location);
        }
        
        report.locations = Array.from(report.locations);
        return report;
    }
}

module.exports = StockTracker;
