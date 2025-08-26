class SalesAnalytics {
    constructor() {
        this.salesData = [];
        this.productPerformance = new Map();
        this.customerSegments = new Map();
        this.forecasts = new Map();
    }

    recordSale(saleData) {
        const sale = {
            id: saleData.id || this.generateSaleId(),
            orderId: saleData.orderId,
            customerId: saleData.customerId,
            productId: saleData.productId,
            quantity: saleData.quantity,
            unitPrice: saleData.unitPrice,
            totalAmount: saleData.quantity * saleData.unitPrice,
            cost: saleData.cost,
            profit: (saleData.quantity * saleData.unitPrice) - saleData.cost,
            salesPerson: saleData.salesPerson,
            channel: saleData.channel || 'online', // online, store, phone
            region: saleData.region,
            timestamp: saleData.timestamp || new Date(),
            refunded: false,
            refundAmount: 0
        };

        this.salesData.push(sale);
        this.updateProductPerformance(sale);
        return sale;
    }

    updateProductPerformance(sale) {
        const productId = sale.productId;
        const existing = this.productPerformance.get(productId) || {
            productId: productId,
            totalSales: 0,
            totalQuantity: 0,
            totalRevenue: 0,
            totalProfit: 0,
            averagePrice: 0,
            salesCount: 0
        };

        existing.totalSales += 1;
        existing.totalQuantity += sale.quantity;
        existing.totalRevenue += sale.totalAmount;
        existing.totalProfit += sale.profit;
        existing.salesCount += 1;
        existing.averagePrice = existing.totalRevenue / existing.totalQuantity;

        this.productPerformance.set(productId, existing);
    }

    getSalesReport(startDate, endDate, groupBy = 'day') {
        const filteredSales = this.salesData.filter(sale => 
            sale.timestamp >= startDate && sale.timestamp <= endDate
        );

        const groupedData = new Map();

        for (const sale of filteredSales) {
            let key;
            const date = sale.timestamp;

            switch (groupBy) {
                case 'day':
                    key = date.toISOString().split('T')[0];
                    break;
                case 'week':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    key = weekStart.toISOString().split('T')[0];
                    break;
                case 'month':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                default:
                    key = date.toISOString().split('T')[0];
            }

            const existing = groupedData.get(key) || {
                period: key,
                salesCount: 0,
                totalRevenue: 0,
                totalProfit: 0,
                totalQuantity: 0,
                averageOrderValue: 0
            };

            existing.salesCount += 1;
            existing.totalRevenue += sale.totalAmount;
            existing.totalProfit += sale.profit;
            existing.totalQuantity += sale.quantity;
            existing.averageOrderValue = existing.totalRevenue / existing.salesCount;

            groupedData.set(key, existing);
        }

        return Array.from(groupedData.values()).sort((a, b) => a.period.localeCompare(b.period));
    }

    getTopProducts(limit = 10, metric = 'revenue') {
        const products = Array.from(this.productPerformance.values());

        products.sort((a, b) => {
            switch (metric) {
                case 'revenue':
                    return b.totalRevenue - a.totalRevenue;
                case 'quantity':
                    return b.totalQuantity - a.totalQuantity;
                case 'profit':
                    return b.totalProfit - a.totalProfit;
                default:
                    return b.totalRevenue - a.totalRevenue;
            }
        });

        return products.slice(0, limit);
    }

    getCustomerAnalytics(customerId) {
        const customerSales = this.salesData.filter(sale => sale.customerId === customerId);
        
        if (customerSales.length === 0) {
            return null;
        }

        const totalRevenue = customerSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const totalOrders = new Set(customerSales.map(sale => sale.orderId)).size;
        const averageOrderValue = totalRevenue / totalOrders;
        const firstPurchase = new Date(Math.min(...customerSales.map(sale => sale.timestamp)));
        const lastPurchase = new Date(Math.max(...customerSales.map(sale => sale.timestamp)));

        const productsBought = new Set(customerSales.map(sale => sale.productId)).size;
        const favoriteProducts = this.getCustomerTopProducts(customerId, 3);

        return {
            customerId: customerId,
            totalRevenue: totalRevenue,
            totalOrders: totalOrders,
            averageOrderValue: averageOrderValue,
            firstPurchase: firstPurchase,
            lastPurchase: lastPurchase,
            productsBought: productsBought,
            favoriteProducts: favoriteProducts,
            lifetimeValue: totalRevenue
        };
    }

    getCustomerTopProducts(customerId, limit = 5) {
        const customerSales = this.salesData.filter(sale => sale.customerId === customerId);
        const productMap = new Map();

        for (const sale of customerSales) {
            const existing = productMap.get(sale.productId) || {
                productId: sale.productId,
                quantity: 0,
                revenue: 0,
                orders: 0
            };

            existing.quantity += sale.quantity;
            existing.revenue += sale.totalAmount;
            existing.orders += 1;

            productMap.set(sale.productId, existing);
        }

        return Array.from(productMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, limit);
    }

    getSalesByChannel(startDate, endDate) {
        const filteredSales = this.salesData.filter(sale => 
            sale.timestamp >= startDate && sale.timestamp <= endDate
        );

        const channelData = new Map();

        for (const sale of filteredSales) {
            const channel = sale.channel;
            const existing = channelData.get(channel) || {
                channel: channel,
                salesCount: 0,
                totalRevenue: 0,
                totalProfit: 0,
                averageOrderValue: 0
            };

            existing.salesCount += 1;
            existing.totalRevenue += sale.totalAmount;
            existing.totalProfit += sale.profit;
            existing.averageOrderValue = existing.totalRevenue / existing.salesCount;

            channelData.set(channel, existing);
        }

        return Array.from(channelData.values());
    }

    getSalesByRegion(startDate, endDate) {
        const filteredSales = this.salesData.filter(sale => 
            sale.timestamp >= startDate && sale.timestamp <= endDate && sale.region
        );

        const regionData = filteredSales.reduce((map, sale) => {
            if (!map.has(sale.region)) map.set(sale.region, {
                region: sale.region,
                salesCount: 0,
                totalRevenue: 0,
                totalProfit: 0,
                marketShare: 0
            });
            const existing = map.get(sale.region);
            existing.salesCount += 1;
            existing.totalRevenue += sale.totalAmount;
            existing.totalProfit += sale.profit;
            return map;
        }, new Map());

        const totalRevenue = Array.from(regionData.values())
            .reduce((sum, region) => sum + region.totalRevenue, 0);

        for (const regionStats of regionData.values()) {
            regionStats.marketShare = (regionStats.totalRevenue / totalRevenue) * 100;
        }

        return Array.from(regionData.values())
            .sort((a, b) => b.totalRevenue - a.totalRevenue);
    }

    calculateGrowthRate(currentPeriodSales, previousPeriodSales) {
        if (previousPeriodSales === 0) {
            return currentPeriodSales > 0 ? 100 : 0;
        }

        return ((currentPeriodSales - previousPeriodSales) / previousPeriodSales) * 100;
    }

    generateForecast(productId, periods = 12) {
        const productSales = this.salesData
            .filter(sale => sale.productId === productId)
            .sort((a, b) => a.timestamp - b.timestamp);

        if (productSales.length < 3) {
            return null; // Not enough data for forecasting
        }

        // Simple moving average forecast
        const recentSales = productSales.slice(-6); // Last 6 sales
        const averageSales = recentSales.reduce((sum, sale) => sum + sale.quantity, 0) / recentSales.length;
        const averageRevenue = recentSales.reduce((sum, sale) => sum + sale.totalAmount, 0) / recentSales.length;

        const forecast = {
            productId: productId,
            forecastPeriods: periods,
            averageQuantity: averageSales,
            averageRevenue: averageRevenue,
            projectedQuantity: averageSales * periods,
            projectedRevenue: averageRevenue * periods,
            confidence: this.calculateConfidence(recentSales),
            createdAt: new Date()
        };

        this.forecasts.set(productId, forecast);
        return forecast;
    }

    calculateConfidence(salesData) {
        // Simple confidence calculation based on variance
        const quantities = salesData.map(sale => sale.quantity);
        const mean = quantities.reduce((sum, qty) => sum + qty, 0) / quantities.length;
        const variance = quantities.reduce((sum, qty) => sum + Math.pow(qty - mean, 2), 0) / quantities.length;
        const standardDeviation = Math.sqrt(variance);
        
        // Lower standard deviation = higher confidence
        const confidence = Math.max(0, Math.min(100, 100 - (standardDeviation / mean) * 100));
        return Math.round(confidence);
    }

    getRefundAnalysis(startDate, endDate) {
        const refundedSales = this.salesData.filter(sale => 
            sale.refunded && 
            sale.timestamp >= startDate && 
            sale.timestamp <= endDate
        );

        const totalRefunds = refundedSales.length;
        const totalRefundAmount = refundedSales.reduce((sum, sale) => sum + sale.refundAmount, 0);
        const totalSalesInPeriod = this.salesData.filter(sale => 
            sale.timestamp >= startDate && sale.timestamp <= endDate
        ).length;

        const refundRate = (totalRefunds / totalSalesInPeriod) * 100;

        return {
            totalRefunds: totalRefunds,
            totalRefundAmount: totalRefundAmount,
            refundRate: refundRate,
            averageRefundAmount: totalRefundAmount / totalRefunds || 0
        };
    }

    processRefund(saleId, refundAmount, reason) {
        const sale = this.salesData.find(sale => sale.id === saleId);
        if (!sale) {
            return null;
        }

        sale.refunded = true;
        sale.refundAmount = refundAmount;
        sale.refundReason = reason;
        sale.refundDate = new Date();

        return sale;
    }

    generateSalesDashboard(startDate, endDate) {
        const filteredSales = this.salesData.filter(sale => 
            sale.timestamp >= startDate && sale.timestamp <= endDate
        );

        const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const totalProfit = filteredSales.reduce((sum, sale) => sum + sale.profit, 0);
        const totalSales = filteredSales.length;
        const uniqueCustomers = new Set(filteredSales.map(sale => sale.customerId)).size;

        return {
            period: { startDate, endDate },
            totalRevenue: totalRevenue,
            totalProfit: totalProfit,
            totalSales: totalSales,
            uniqueCustomers: uniqueCustomers,
            averageOrderValue: totalRevenue / totalSales || 0,
            profitMargin: (totalProfit / totalRevenue) * 100 || 0,
            topProducts: this.getTopProducts(5),
            salesByChannel: this.getSalesByChannel(startDate, endDate),
            salesByRegion: this.getSalesByRegion(startDate, endDate)
        };
    }

    generateSaleId() {
        return `SALE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    exportAnalytics(format = 'json') {
        const data = {
            salesData: this.salesData,
            productPerformance: Array.from(this.productPerformance.values()),
            forecasts: Array.from(this.forecasts.values())
        };

        if (format === 'csv') {
            let csv = 'Sale ID,Customer ID,Product ID,Quantity,Unit Price,Total Amount,Profit,Channel,Region,Timestamp\n';
            for (const sale of this.salesData) {
                csv += `${sale.id},${sale.customerId},${sale.productId},${sale.quantity},${sale.unitPrice},${sale.totalAmount},${sale.profit},${sale.channel},${sale.region || ''},${sale.timestamp.toISOString()}\n`;
            }
            return csv;
        }

        return JSON.stringify(data, null, 2);
    }
}

module.exports = SalesAnalytics;