const fs = require('fs');
const path = require('path');

class InvoiceProcessor {
    constructor() {
        this.invoices = [];
        this.outputDir = './invoices';
    }

    async processInvoice(invoiceData) {
        try {
            if (!invoiceData || !invoiceData.customer) {
                throw new Error('Invalid invoice data');
            }

            const invoice = {
                id: this.generateInvoiceId(),
                customer: invoiceData.customer,
                items: invoiceData.items || [],
                subtotal: 0,
                tax: 0,
                total: 0,
                status: 'pending',
                createdAt: new Date(),
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            };

            invoice.subtotal = this.calculateSubtotal(invoice.items);
            invoice.tax = invoice.subtotal * 0.1;
            invoice.total = invoice.subtotal + invoice.tax;

            this.invoices.push(invoice);
            await this.saveInvoice(invoice);

            return invoice;
        } catch (error) {
            console.error('Error processing invoice:', error.message);
            return null;
        }
    }

    calculateSubtotal(items) {
        return items.reduce((sum, item) => {
            return sum + (item.price || 0) * (item.quantity || 1);
        }, 0);
    }

    generateInvoiceId() {
        return 'INV-' + Date.now().toString().slice(-6);
    }

    async saveInvoice(invoice) {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        const filename = `invoice-${invoice.id}.json`;
        const filepath = path.join(this.outputDir, filename);

        try {
            await fs.promises.writeFile(filepath, JSON.stringify(invoice, null, 2));
        } catch (error) {
            console.error('Failed to save invoice:', error.message);
        }
    }

    async loadInvoices() {
        try {
            if (!fs.existsSync(this.outputDir)) {
                return [];
            }

            const files = await fs.promises.readdir(this.outputDir);
            const invoiceFiles = files.filter(file => file.endsWith('.json'));

            for (const file of invoiceFiles) {
                const filepath = path.join(this.outputDir, file);
                const content = await fs.promises.readFile(filepath, 'utf8');
                const invoice = JSON.parse(content);
                this.invoices.push(invoice);
            }

            return this.invoices;
        } catch (error) {
            console.error('Error loading invoices:', error.message);
            return [];
        }
    }

    getInvoiceById(id) {
        return this.invoices.find(invoice => invoice.id === id);
    }

    updateInvoiceStatus(id, status) {
        const invoice = this.getInvoiceById(id);
        if (invoice) {
            invoice.status = status;
            invoice.updatedAt = new Date();
            return true;
        }
        return false;
    }

    deleteInvoice(id) {
        const index = this.invoices.findIndex(invoice => invoice.id === id);
        if (index !== -1) {
            this.invoices.splice(index, 1);
            return true;
        }
        return false;
    }

    getInvoicesByCustomer(customerName) {
        return this.invoices.filter(invoice => 
            invoice.customer.toLowerCase().includes(customerName.toLowerCase())
        );
    }

    calculateTotalRevenue() {
        return this.invoices
            .filter(invoice => invoice.status === 'paid')
            .reduce((total, invoice) => total + invoice.total, 0);
    }

    getOverdueInvoices() {
        const now = new Date();
        return this.invoices.filter(invoice => 
            invoice.status !== 'paid' && invoice.dueDate < now
        );
    }
}

module.exports = InvoiceProcessor; 
