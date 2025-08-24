const fs = require('fs');

class OrderTracking {
    constructor() {
        this.orders = new Map();
        this.orderItems = new Map();
        this.orderStatuses = [
            'pending',
            'confirmed',
            'processing',
            'shipped',
            'delivered',
            'cancelled',
            'returned'
        ];
        this.notifications = [];
    }

    createOrder(orderData) {
        const order = {
            id: orderData.id || this.generateOrderId(),
            customerId: orderData.customerId,
            orderNumber: orderData.orderNumber || this.generateOrderNumber(),
            status: 'pending',
            orderDate: new Date(),
            expectedDelivery: orderData.expectedDelivery,
            shippingMethod: orderData.shippingMethod || 'standard',
            shippingAddress: orderData.shippingAddress,
            billingAddress: orderData.billingAddress,
            items: [],
            subtotal: 0,
            tax: 0,
            shipping: orderData.shipping || 0,
            discount: orderData.discount || 0,
            total: 0,
            notes: orderData.notes || '',
            trackingNumber: null,
            carrier: null,
            statusHistory: [{
                status: 'pending',
                timestamp: new Date(),
                notes: 'Order created'
            }]
        };

        if (orderData.items) {
            for (const item of orderData.items) {
                this.addOrderItem(order.id, item);
            }
        }

        this.calculateOrderTotal(order);
        this.orders.set(order.id, order);
        return order;
    }

    addOrderItem(orderId, itemData) {
        const order = this.orders.get(orderId);
        if (!order) {
            return null;
        }

        const item = {
            id: this.generateItemId(),
            orderId: orderId,
            productId: itemData.productId,
            sku: itemData.sku,
            name: itemData.name,
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            discount: itemData.discount || 0,
            total: (itemData.quantity * itemData.unitPrice) - (itemData.discount || 0)
        };

        this.orderItems.set(item.id, item);
        order.items.push(item.id);
        this.calculateOrderTotal(order);
        return item;
    }

    updateOrderStatus(orderId, newStatus, notes = '') {
        const order = this.orders.get(orderId);
        if (!order) {
            return null;
        }

        if (!this.orderStatuses.includes(newStatus)) {
            throw new Error('Invalid order status');
        }

        const previousStatus = order.status;
        order.status = newStatus;
        order.statusHistory.push({
            status: newStatus,
            timestamp: new Date(),
            notes: notes,
            previousStatus: previousStatus
        });

        this.sendNotification(order.customerId, {
            type: 'status_update',
            orderId: orderId,
            newStatus: newStatus,
            message: `Order ${order.orderNumber} status updated to ${newStatus}`
        });

        return order;
    }

    addTrackingInfo(orderId, trackingNumber, carrier) {
        const order = this.orders.get(orderId);
        if (!order) {
            return null;
        }

        order.trackingNumber = trackingNumber;
        order.carrier = carrier;
        order.statusHistory.push({
            status: order.status,
            timestamp: new Date(),
            notes: `Tracking number added: ${trackingNumber} (${carrier})`
        });

        this.sendNotification(order.customerId, {
            type: 'tracking_added',
            orderId: orderId,
            trackingNumber: trackingNumber,
            carrier: carrier,
            message: `Tracking information added for order ${order.orderNumber}`
        });

        return order;
    }

    getOrder(orderId) {
        const order = this.orders.get(orderId);
        if (!order) {
            return null;
        }

        const orderWithItems = { ...order };
        orderWithItems.items = order.items.map(itemId => this.orderItems.get(itemId));
        return orderWithItems;
    }

    getOrdersByCustomer(customerId) {
        return Array.from(this.orders.values())
            .filter(order => order.customerId === customerId)
            .sort((a, b) => b.orderDate - a.orderDate);
    }

    getOrdersByStatus(status) {
        return Array.from(this.orders.values())
            .filter(order => order.status === status)
            .sort((a, b) => b.orderDate - a.orderDate);
    }

    searchOrders(query) {
        const results = [];
        const searchTerm = query.toLowerCase();

        for (const order of this.orders.values()) {
            if (order.orderNumber.toLowerCase().includes(searchTerm) ||
                order.trackingNumber?.toLowerCase().includes(searchTerm) ||
                order.id.toLowerCase().includes(searchTerm)) {
                results.push(order);
            }
        }

        return results;
    }

    calculateOrderTotal(order) {
        let subtotal = 0;

        for (const itemId of order.items) {
            const item = this.orderItems.get(itemId);
            if (item) {
                subtotal += item.total;
            }
        }

        order.subtotal = subtotal;
        order.total = subtotal + order.tax + order.shipping - order.discount;
    }

    cancelOrder(orderId, reason = '') {
        const order = this.orders.get(orderId);
        if (!order) {
            return null;
        }

        if (['shipped', 'delivered'].includes(order.status)) {
            throw new Error('Cannot cancel order that has been shipped or delivered');
        }

        order.status = 'cancelled';
        order.cancelledAt = new Date();
        order.cancellationReason = reason;
        order.statusHistory.push({
            status: 'cancelled',
            timestamp: new Date(),
            notes: `Order cancelled: ${reason}`
        });

        this.sendNotification(order.customerId, {
            type: 'order_cancelled',
            orderId: orderId,
            reason: reason,
            message: `Order ${order.orderNumber} has been cancelled`
        });

        return order;
    }

    processReturn(orderId, items, reason) {
        const order = this.orders.get(orderId);
        if (!order) {
            return null;
        }

        if (order.status !== 'delivered') {
            throw new Error('Can only process returns for delivered orders');
        }

        const returnData = {
            id: this.generateReturnId(),
            orderId: orderId,
            customerId: order.customerId,
            items: items,
            reason: reason,
            status: 'pending',
            createdAt: new Date(),
            processedAt: null
        };

        order.returns = order.returns || [];
        order.returns.push(returnData);

        this.sendNotification(order.customerId, {
            type: 'return_initiated',
            orderId: orderId,
            returnId: returnData.id,
            message: `Return initiated for order ${order.orderNumber}`
        });

        return returnData;
    }

    updateDeliveryEstimate(orderId, newEstimate) {
        const order = this.orders.get(orderId);
        if (!order) {
            return null;
        }

        const previousEstimate = order.expectedDelivery;
        order.expectedDelivery = newEstimate;
        order.statusHistory.push({
            status: order.status,
            timestamp: new Date(),
            notes: `Delivery estimate updated from ${previousEstimate} to ${newEstimate}`
        });

        if (newEstimate > previousEstimate) {
            this.sendNotification(order.customerId, {
                type: 'delivery_delayed',
                orderId: orderId,
                newEstimate: newEstimate,
                message: `Delivery estimate updated for order ${order.orderNumber}`
            });
        }

        return order;
    }

    sendNotification(customerId, notificationData) {
        const notification = {
            id: this.generateNotificationId(),
            customerId: customerId,
            ...notificationData,
            timestamp: new Date(),
            read: false
        };

        this.notifications.push(notification);
        this.clearOldNotifications();
        return notification;
    }

    clearOldNotifications(thresholdDays = 30) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);
        this.notifications = this.notifications.filter(notification => notification.timestamp >= thresholdDate);
    }

    getCustomerNotifications(customerId, limit = 20) {
        return this.notifications
            .filter(notification => notification.customerId === customerId)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    markNotificationRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            return true;
        }
        return false;
    }

    getOrderMetrics(startDate, endDate) {
        const orders = Array.from(this.orders.values())
            .filter(order => order.orderDate >= startDate && order.orderDate <= endDate);

        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
        const averageOrderValue = totalRevenue / totalOrders || 0;
        const cancelledOrders = orders.filter(order => order.status === 'cancelled').length;
        const deliveredOrders = orders.filter(order => order.status === 'delivered').length;

        return {
            totalOrders,
            totalRevenue,
            averageOrderValue: Math.round(averageOrderValue * 100) / 100,
            cancelledOrders,
            deliveredOrders,
            cancellationRate: (cancelledOrders / totalOrders) * 100 || 0,
            fulfillmentRate: (deliveredOrders / totalOrders) * 100 || 0
        };
    }

    generateOrderId() {
        return `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateOrderNumber() {
        return `${Date.now().toString().slice(-6)}`;
    }

    generateItemId() {
        return `ITEM_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    generateReturnId() {
        return `RET_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    generateNotificationId() {
        return `NOT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    exportOrders(format = 'json', filters = {}) {
        let orders = Array.from(this.orders.values());

        if (filters.status) {
            orders = orders.filter(order => order.status === filters.status);
        }
        if (filters.customerId) {
            orders = orders.filter(order => order.customerId === filters.customerId);
        }
        if (filters.startDate && filters.endDate) {
            orders = orders.filter(order => 
                order.orderDate >= filters.startDate && order.orderDate <= filters.endDate
            );
        }

        if (format === 'csv') {
            let csv = 'Order ID,Order Number,Customer ID,Status,Order Date,Total,Tracking Number\n';
            for (const order of orders) {
                csv += `${order.id},${order.orderNumber},${order.customerId},${order.status},${order.orderDate.toISOString()},${order.total},${order.trackingNumber || ''}\n`;
            }
            return csv;
        }

        return JSON.stringify(orders, null, 2);
    }
}

module.exports = OrderTracking;