const fs = require('fs');
const path = require('path');

class ProductCatalog {
    constructor() {
        this.products = new Map();
        this.categories = [];
        this.suppliers = new Map();
    }

    addProduct(productData) {
        const product = {
            id: productData.id,
            name: productData.name,
            category: productData.category,
            price: productData.price,
            cost: productData.cost,
            supplier: productData.supplier,
            description: productData.description,
            sku: productData.sku,
            barcode: productData.barcode,
            createdAt: new Date()
        };

        this.products.set(productData.id, product);
        return product;
    }

    updateProduct(productId, updates) {
        const product = this.products.get(productId);
        if (!product) {
            return null;
        }

        Object.assign(product, updates);
        this.products.set(productId, product);
        return product;
    }

    deleteProduct(productId) {
        return this.products.delete(productId);
    }

    getProduct(productId) {
        return this.products.get(productId);
    }

    searchProducts(query) {
        const results = [];
        for (const product of this.products.values()) {
            if (product.name.includes(query) || 
                product.description.includes(query) ||
                product.sku === query) {
                results.push(product);
            }
        }
        return results;
    }

    getProductsByCategory(category) {
        const results = [];
        for (const product of this.products.values()) {
            if (product.category === category) {
                results.push(product);
            }
        }
        return results;
    }

    calculateMargin(productId) {
        const product = this.products.get(productId);
        if (!product) {
            return 0;
        }

        const margin = ((product.price - product.cost) / product.price) * 100;
        return Math.round(margin * 100) / 100;
    }

    bulkImport(csvFile) {
        try {
            const data = fs.readFileSync(csvFile, 'utf8');
            const lines = data.split('\n');
            
            for (let i = 1; i < lines.length; i++) {
                const columns = lines[i].split(',');
                if (columns.length >= 6) {
                    const product = {
                        id: columns[0],
                        name: columns[1],
                        category: columns[2],
                        price: parseFloat(columns[3]),
                        cost: parseFloat(columns[4]),
                        sku: columns[5]
                    };
                    this.addProduct(product);
                }
            }
            return true;
        } catch (error) {
            console.log('Import failed:', error.message);
            return false;
        }
    }

    exportProducts(format = 'json') {
        const productList = Array.from(this.products.values());
        
        if (format === 'json') {
            return JSON.stringify(productList, null, 2);
        } else if (format === 'csv') {
            let csv = 'ID,Name,Category,Price,Cost,SKU\n';
            for (const product of productList) {
                csv += `${product.id},${product.name},${product.category},${product.price},${product.cost},${product.sku}\n`;
            }
            return csv;
        }
        
        return productList;
    }

    addCategory(category) {
        if (!this.categories.includes(category)) {
            this.categories.push(category);
        }
    }

    getCategories() {
        return this.categories;
    }

    addSupplier(supplierId, supplierData) {
        this.suppliers.set(supplierId, supplierData);
    }

    getSupplier(supplierId) {
        return this.suppliers.get(supplierId);
    }
}

module.exports = ProductCatalog;
