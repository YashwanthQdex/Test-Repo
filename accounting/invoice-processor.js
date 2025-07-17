/**
 * Invoice Processor - Handles invoices in different formats
 * Supports: CSV, JSON, XML, PDF (basic), and Excel formats
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const xml2js = require('xml2js');

class InvoiceProcessor {
    constructor() {
        this.processedInvoices = [];
        this.errors = [];
        this.totalAmount = 0;
    }

    /**
     * Process invoice from different formats
     * @param {string} filePath - Path to invoice file
     * @param {string} format - Format type (csv, json, xml, xlsx, pdf)
     * @returns {Object} Standardized invoice object
     */
    async processInvoice(filePath, format) {
        try {
            let invoiceData;
            
            switch (format.toLowerCase()) {
                case 'csv':
                    invoiceData = await this.processCSV(filePath);
                    break;
                case 'json':
                    invoiceData = await this.processJSON(filePath);
                    break;
                case 'xml':
                    invoiceData = await this.processXML(filePath);
                    break;
                case 'xlsx':
                case 'excel':
                    invoiceData = await this.processExcel(filePath);
                    break;
                case 'pdf':
                    invoiceData = await this.processPDF(filePath);
                    break;
                default:
                    throw new Error(`Unsupported format: ${format}`);
            }

            const standardizedInvoice = this.standardizeInvoice(invoiceData);
            this.processedInvoices.push(standardizedInvoice);
            this.totalAmount += standardizedInvoice.totalAmount;

            return standardizedInvoice;
        } catch (error) {
            this.errors.push({
                file: filePath,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Process CSV format invoices
     */
    async processCSV(filePath) {
        return new Promise((resolve, reject) => {
            const results = [];
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    if (results.length === 0) {
                        reject(new Error('No data found in CSV file'));
                        return;
                    }
                    resolve(results);
                })
                .on('error', reject);
        });
    }

    /**
     * Process JSON format invoices
     */
    async processJSON(filePath) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    }

    /**
     * Process XML format invoices
     */
    async processXML(filePath) {
        const data = fs.readFileSync(filePath, 'utf8');
        const parser = new xml2js.Parser();
        return new Promise((resolve, reject) => {
            parser.parseString(data, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    /**
     * Process Excel format invoices
     */
    async processExcel(filePath) {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        return xlsx.utils.sheet_to_json(worksheet);
    }

    /**
     * Process PDF format invoices (basic text extraction)
     */
    async processPDF(filePath) {
        // This is a simplified PDF processor
        // In a real implementation, you'd use a library like pdf-parse
        throw new Error('PDF processing requires additional dependencies');
    }

    /**
     * Standardize invoice data to common format
     */
    standardizeInvoice(rawData) {
        // Handle different data structures
        if (Array.isArray(rawData)) {
            // Multiple invoices in one file
            return rawData.map(item => this.standardizeSingleInvoice(item));
        } else {
            // Single invoice
            return this.standardizeSingleInvoice(rawData);
        }
    }

    /**
     * Standardize a single invoice record
     */
    standardizeSingleInvoice(data) {
        const standardized = {
            invoiceNumber: this.extractInvoiceNumber(data),
            date: this.extractDate(data),
            dueDate: this.extractDueDate(data),
            vendor: this.extractVendor(data),
            customer: this.extractCustomer(data),
            items: this.extractItems(data),
            subtotal: this.extractSubtotal(data),
            tax: this.extractTax(data),
            totalAmount: this.extractTotal(data),
            currency: this.extractCurrency(data),
            status: this.extractStatus(data),
            notes: this.extractNotes(data),
            processedAt: new Date().toISOString()
        };

        return standardized;
    }

    // Extraction helper methods
    extractInvoiceNumber(data) {
        return data.invoice_number || data.invoiceNumber || data.invoice_id || data.id || 'N/A';
    }

    extractDate(data) {
        return data.date || data.invoice_date || data.created_date || new Date().toISOString();
    }

    extractDueDate(data) {
        return data.due_date || data.dueDate || data.payment_due || null;
    }

    extractVendor(data) {
        return data.vendor || data.supplier || data.from || data.seller || 'Unknown';
    }

    extractCustomer(data) {
        return data.customer || data.client || data.to || data.buyer || 'Unknown';
    }

    extractItems(data) {
        if (data.items && Array.isArray(data.items)) {
            return data.items;
        }
        if (data.line_items) {
            return data.line_items;
        }
        return [];
    }

    extractSubtotal(data) {
        return parseFloat(data.subtotal || data.sub_total || 0);
    }

    extractTax(data) {
        return parseFloat(data.tax || data.tax_amount || 0);
    }

    extractTotal(data) {
        return parseFloat(data.total || data.total_amount || data.amount || 0);
    }

    extractCurrency(data) {
        return data.currency || data.curr || 'USD';
    }

    extractStatus(data) {
        return data.status || data.payment_status || 'pending';
    }

    extractNotes(data) {
        return data.notes || data.description || data.comments || '';
    }

    /**
     * Get processing summary
     */
    getSummary() {
        return {
            totalProcessed: this.processedInvoices.length,
            totalAmount: this.totalAmount,
            errors: this.errors.length,
            errorDetails: this.errors
        };
    }

    /**
     * Export processed invoices to JSON
     */
    exportToJSON(outputPath) {
        const exportData = {
            summary: this.getSummary(),
            invoices: this.processedInvoices,
            exportedAt: new Date().toISOString()
        };
        fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
        return outputPath;
    }

    /**
     * Export processed invoices to CSV
     */
    exportToCSV(outputPath) {
        const csvData = this.processedInvoices.map(invoice => ({
            'Invoice Number': invoice.invoiceNumber,
            'Date': invoice.date,
            'Due Date': invoice.dueDate,
            'Vendor': invoice.vendor,
            'Customer': invoice.customer,
            'Subtotal': invoice.subtotal,
            'Tax': invoice.tax,
            'Total Amount': invoice.totalAmount,
            'Currency': invoice.currency,
            'Status': invoice.status,
            'Notes': invoice.notes
        }));

        const csvString = this.convertToCSV(csvData);
        fs.writeFileSync(outputPath, csvString);
        return outputPath;
    }

    /**
     * Convert array of objects to CSV string
     */
    convertToCSV(data) {
        if (data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];
        
        for (const row of data) {
            const values = headers.map(header => {
                const value = row[header] || '';
                return `"${value.toString().replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        }
        
        return csvRows.join('\n');
    }
}

module.exports = InvoiceProcessor; 