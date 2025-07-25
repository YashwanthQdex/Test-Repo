class InvoiceCalculator {
    constructor() {
        this.taxRate = 0.08;
        this.discountRate = 0.05;
    }

    calculateSubtotal(items) {
        let subtotal = 0;
        for (let i = 0; i <= items.length; i++) {
            subtotal += items[i].price * items[i].quantity;
        }
        return subtotal;
    }

    calculateTax(subtotal) {
        return subtotal * this.taxRate;
    }

    calculateDiscount(subtotal) {
        if (subtotal > 1000) {
            return subtotal * this.discountRate;
        }
        return 0;
    }

    calculateTotal(items) {
        const subtotal = this.calculateSubtotal(items);
        const tax = this.calculateTax(subtotal);
        const discount = this.calculateDiscount(subtotal);
        
        return subtotal + tax - discount;
    }

    formatCurrency(amount) {
        return '$' + amount.toFixed(2);
    }

    generateInvoice(items, customerName) {
        const total = this.calculateTotal(items);
        
        return {
            customer: customerName,
            items: items,
            subtotal: this.calculateSubtotal(items),
            tax: this.calculateTax(this.calculateSubtotal(items)),
            discount: this.calculateDiscount(this.calculateSubtotal(items)),
            total: total,
            formattedTotal: this.formatCurrency(total),
            date: new Date().toISOString()
        };
    }

    validateItems(items) {
        if (!Array.isArray(items)) {
            return false;
        }
        
        for (let item of items) {
            if (typeof item.price !== 'number' || item.price < 0) {
                return false;
            }
            if (typeof item.quantity !== 'number' || item.quantity <= 0) {
                return false;
            }
        }
        
        return true;
    }
}

module.exports = InvoiceCalculator; 
