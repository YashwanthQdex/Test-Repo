/**
 * Test file for the Accounting System
 * Demonstrates various features and capabilities
 */

const AccountingApp = require('./accounting-app');
const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log('🧪 Testing Accounting System...\n');
    
    const app = new AccountingApp();
    
    try {
        // Test 1: Process single JSON invoice
        console.log('📋 Test 1: Processing single JSON invoice');
        const jsonResult = await app.processSingleInvoice(
            path.join(app.sampleDir, 'invoice-1.json'),
            'json'
        );
        console.log(`   Result: Invoice #${jsonResult.invoiceNumber} - $${jsonResult.totalAmount}\n`);

        // Test 2: Process CSV file with multiple invoices
        console.log('📋 Test 2: Processing CSV file with multiple invoices');
        const csvResult = await app.processor.processInvoice(
            path.join(app.sampleDir, 'invoices.csv'),
            'csv'
        );
        console.log(`   Result: Processed ${csvResult.length} invoices\n`);

        // Test 3: Process XML invoice
        console.log('📋 Test 3: Processing XML invoice');
        const xmlResult = await app.processSingleInvoice(
            path.join(app.sampleDir, 'invoice.xml'),
            'xml'
        );
        console.log(`   Result: Invoice #${xmlResult.invoiceNumber} - $${xmlResult.totalAmount}\n`);

        // Test 4: Validation
        console.log('📋 Test 4: Invoice validation');
        const validation = app.validateInvoice(jsonResult);
        console.log(`   Valid: ${validation.isValid}`);
        if (!validation.isValid) {
            console.log(`   Errors: ${validation.errors.join(', ')}`);
        }
        console.log('');

        // Test 5: Queries
        console.log('📋 Test 5: Query operations');
        const pendingInvoices = app.getInvoicesByStatus('pending');
        const techInvoices = app.getInvoicesByVendor('Tech');
        const januaryTotal = app.getTotalByDateRange('2024-01-01', '2024-01-31');
        
        console.log(`   Pending invoices: ${pendingInvoices.length}`);
        console.log(`   Tech invoices: ${techInvoices.length}`);
        console.log(`   January total: $${januaryTotal.toFixed(2)}\n`);

        // Test 6: Export functionality
        console.log('📋 Test 6: Export functionality');
        const jsonExportPath = path.join(app.outputDir, 'test-export.json');
        const csvExportPath = path.join(app.outputDir, 'test-export.csv');
        
        app.processor.exportToJSON(jsonExportPath);
        app.processor.exportToCSV(csvExportPath);
        
        console.log(`   JSON exported to: ${jsonExportPath}`);
        console.log(`   CSV exported to: ${csvExportPath}\n`);

        // Test 7: Summary
        console.log('📋 Test 7: Processing summary');
        const summary = app.processor.getSummary();
        console.log(`   Total processed: ${summary.totalProcessed}`);
        console.log(`   Total amount: $${summary.totalAmount.toFixed(2)}`);
        console.log(`   Errors: ${summary.errors}\n`);

        console.log('✅ All tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Test specific format processing
async function testFormatProcessing() {
    console.log('🔧 Testing format-specific processing...\n');
    
    const app = new AccountingApp();
    
    // Test different field mappings
    const testData = {
        // Different field name variations
        invoice_id: 'TEST-001',
        invoice_date: '2024-01-15',
        payment_due: '2024-02-15',
        supplier: 'Test Supplier',
        client: 'Test Client',
        sub_total: 1000.00,
        tax_amount: 100.00,
        amount: 1100.00,
        curr: 'USD',
        payment_status: 'paid',
        description: 'Test invoice'
    };
    
    console.log('📋 Testing field mapping variations:');
    const standardized = app.processor.standardizeSingleInvoice(testData);
    
    console.log(`   Invoice Number: ${standardized.invoiceNumber}`);
    console.log(`   Date: ${standardized.date}`);
    console.log(`   Vendor: ${standardized.vendor}`);
    console.log(`   Customer: ${standardized.customer}`);
    console.log(`   Total: ${standardized.currency} ${standardized.totalAmount}`);
    console.log(`   Status: ${standardized.status}\n`);
}

// Run all tests
async function main() {
    await runTests();
    await testFormatProcessing();
}

if (require.main === module) {
    main();
}

module.exports = { runTests, testFormatProcessing }; 