/**
 * Accounting Application - Main entry point for invoice processing
 * Demonstrates processing invoices in different formats
 */

const InvoiceProcessor = require('./invoice-processor');
const fs = require('fs');
const path = require('path');

class AccountingApp {
    constructor() {
        this.processor = new InvoiceProcessor();
        this.sampleDir = path.join(__dirname, 'sample-invoices');
        this.outputDir = path.join(__dirname, 'output');
        
        // Create output directory if it doesn't exist
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Process all sample invoices
     */
    async processAllInvoices() {
        console.log('🚀 Starting invoice processing...\n');

        try {
            // Process JSON invoice
            console.log('📄 Processing JSON invoice...');
            await this.processor.processInvoice(
                path.join(this.sampleDir, 'invoice-1.json'),
                'json'
            );
            console.log('✅ JSON invoice processed successfully\n');

            // Process CSV invoices (multiple invoices in one file)
            console.log('📊 Processing CSV invoices...');
            await this.processor.processInvoice(
                path.join(this.sampleDir, 'invoices.csv'),
                'csv'
            );
            console.log('✅ CSV invoices processed successfully\n');

            // Process XML invoice
            console.log('📋 Processing XML invoice...');
            await this.processor.processInvoice(
                path.join(this.sampleDir, 'invoice.xml'),
                'xml'
            );
            console.log('✅ XML invoice processed successfully\n');

            // Generate reports
            await this.generateReports();

        } catch (error) {
            console.error('❌ Error processing invoices:', error.message);
            console.log('\n📋 Processing Summary:');
            console.log(this.processor.getSummary());
        }
    }

    /**
     * Process a single invoice file
     */
    async processSingleInvoice(filePath, format) {
        try {
            console.log(`📄 Processing ${format.toUpperCase()} invoice: ${path.basename(filePath)}`);
            const result = await this.processor.processInvoice(filePath, format);
            console.log('✅ Invoice processed successfully');
            console.log(`   Invoice #: ${result.invoiceNumber}`);
            console.log(`   Amount: ${result.currency} ${result.totalAmount}`);
            console.log(`   Vendor: ${result.vendor}`);
            return result;
        } catch (error) {
            console.error(`❌ Error processing ${format} invoice:`, error.message);
            throw error;
        }
    }

    /**
     * Generate reports from processed invoices
     */
    async generateReports() {
        console.log('📊 Generating reports...\n');

        // Export to JSON
        const jsonOutputPath = path.join(this.outputDir, 'processed-invoices.json');
        this.processor.exportToJSON(jsonOutputPath);
        console.log(`📄 JSON report saved to: ${jsonOutputPath}`);

        // Export to CSV
        const csvOutputPath = path.join(this.outputDir, 'processed-invoices.csv');
        this.processor.exportToCSV(csvOutputPath);
        console.log(`📊 CSV report saved to: ${csvOutputPath}`);

        // Display summary
        console.log('\n📋 Processing Summary:');
        const summary = this.processor.getSummary();
        console.log(`   Total Invoices Processed: ${summary.totalProcessed}`);
        console.log(`   Total Amount: $${summary.totalAmount.toFixed(2)}`);
        console.log(`   Errors: ${summary.errors}`);
        
        if (summary.errors > 0) {
            console.log('\n❌ Error Details:');
            summary.errorDetails.forEach(error => {
                console.log(`   - ${error.file}: ${error.error}`);
            });
        }

        // Display vendor summary
        this.displayVendorSummary();
    }

    /**
     * Display summary by vendor
     */
    displayVendorSummary() {
        console.log('\n🏢 Vendor Summary:');
        const vendorTotals = {};
        
        this.processor.processedInvoices.forEach(invoice => {
            const vendor = invoice.vendor;
            if (!vendorTotals[vendor]) {
                vendorTotals[vendor] = 0;
            }
            vendorTotals[vendor] += invoice.totalAmount;
        });

        Object.entries(vendorTotals)
            .sort(([,a], [,b]) => b - a)
            .forEach(([vendor, total]) => {
                console.log(`   ${vendor}: $${total.toFixed(2)}`);
            });
    }

    /**
     * Display invoice details
     */
    displayInvoiceDetails() {
        console.log('\n📋 Invoice Details:');
        this.processor.processedInvoices.forEach((invoice, index) => {
            console.log(`\n${index + 1}. Invoice #${invoice.invoiceNumber}`);
            console.log(`   Date: ${invoice.date}`);
            console.log(`   Vendor: ${invoice.vendor}`);
            console.log(`   Customer: ${invoice.customer}`);
            console.log(`   Amount: ${invoice.currency} ${invoice.totalAmount}`);
            console.log(`   Status: ${invoice.status}`);
            if (invoice.notes) {
                console.log(`   Notes: ${invoice.notes}`);
            }
        });
    }

    /**
     * Validate invoice data
     */
    validateInvoice(invoice) {
        const errors = [];
        
        if (!invoice.invoiceNumber || invoice.invoiceNumber === 'N/A') {
            errors.push('Missing invoice number');
        }
        
        if (!invoice.vendor || invoice.vendor === 'Unknown') {
            errors.push('Missing vendor information');
        }
        
        if (invoice.totalAmount <= 0) {
            errors.push('Invalid total amount');
        }
        
        if (!invoice.date) {
            errors.push('Missing invoice date');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Get invoices by status
     */
    getInvoicesByStatus(status) {
        return this.processor.processedInvoices.filter(invoice => 
            invoice.status.toLowerCase() === status.toLowerCase()
        );
    }

    /**
     * Get invoices by vendor
     */
    getInvoicesByVendor(vendor) {
        return this.processor.processedInvoices.filter(invoice => 
            invoice.vendor.toLowerCase().includes(vendor.toLowerCase())
        );
    }

    /**
     * Get total amount by date range
     */
    getTotalByDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return this.processor.processedInvoices
            .filter(invoice => {
                const invoiceDate = new Date(invoice.date);
                return invoiceDate >= start && invoiceDate <= end;
            })
            .reduce((total, invoice) => total + invoice.totalAmount, 0);
    }
}

// Example usage
async function main() {
    const app = new AccountingApp();
    
    try {
        // Process all sample invoices
        await app.processAllInvoices();
        
        // Display detailed invoice information
        app.displayInvoiceDetails();
        
        // Example queries
        console.log('\n🔍 Example Queries:');
        
        const pendingInvoices = app.getInvoicesByStatus('pending');
        console.log(`   Pending invoices: ${pendingInvoices.length}`);
        
        const techInvoices = app.getInvoicesByVendor('Tech');
        console.log(`   Tech-related invoices: ${techInvoices.length}`);
        
        const januaryTotal = app.getTotalByDateRange('2024-01-01', '2024-01-31');
        console.log(`   January 2024 total: $${januaryTotal.toFixed(2)}`);
        
    } catch (error) {
        console.error('❌ Application error:', error.message);
    }
}

// Run the application if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = AccountingApp; 