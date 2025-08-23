class InvoiceTemplate {
    constructor() {
        this.templates = new Map();
        this.defaultTemplate = 'standard';
        this.companyInfo = {};
    }

    setCompanyInfo(info) {
        this.companyInfo = {
            name: info.name,
            address: info.address,
            phone: info.phone,
            email: info.email,
            website: info.website,
            taxId: info.taxId,
            logo: info.logo
        };
    }

    createTemplate(templateId, templateData) {
        const template = {
            id: templateId,
            name: templateData.name,
            layout: templateData.layout || 'standard',
            colors: templateData.colors || {
                primary: '#2563eb',
                secondary: '#64748b',
                accent: '#f59e0b'
            },
            fonts: templateData.fonts || {
                primary: 'Arial',
                secondary: 'Helvetica'
            },
            sections: templateData.sections || [
                'header',
                'billing',
                'items',
                'totals',
                'footer'
            ],
            customFields: templateData.customFields || [],
            footer: templateData.footer || 'Thank you for your business!'
        };

        this.templates.set(templateId, template);
        return template;
    }

    generateInvoiceHtml(invoiceData, templateId = null) {
        const template = this.templates.get(templateId || this.defaultTemplate);
        if (!template) {
            throw new Error('Template not found');
        }

        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Invoice ${invoiceData.invoiceNumber}</title>
            <style>
                body { font-family: ${template.fonts.primary}, sans-serif; margin: 0; padding: 20px; }
                .header { border-bottom: 2px solid ${template.colors.primary}; padding-bottom: 20px; }
                .company-info { float: left; }
                .invoice-info { float: right; text-align: right; }
                .billing-section { margin: 30px 0; clear: both; }
                .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .items-table th { background-color: ${template.colors.primary}; color: white; }
                .totals { float: right; margin-top: 20px; }
                .footer { text-align: center; margin-top: 50px; color: ${template.colors.secondary}; }
            </style>
        </head>
        <body>
        `;

        if (template.sections.includes('header')) {
            html += this.generateHeader(invoiceData, template);
        }

        if (template.sections.includes('billing')) {
            html += this.generateBillingSection(invoiceData);
        }

        if (template.sections.includes('items')) {
            html += this.generateItemsTable(invoiceData);
        }

        if (template.sections.includes('totals')) {
            html += this.generateTotals(invoiceData);
        }

        if (template.sections.includes('footer')) {
            html += this.generateFooter(template);
        }

        html += `
        </body>
        </html>
        `;

        return html;
    }

    generateHeader(invoiceData, template) {
        return `
        <div class="header">
            <div class="company-info">
                ${this.companyInfo.logo ? `<img src="${this.companyInfo.logo}" alt="Company Logo" height="60">` : ''}
                <h2>${this.companyInfo.name}</h2>
                <p>${this.companyInfo.address}</p>
                <p>Phone: ${this.companyInfo.phone}</p>
                <p>Email: ${this.companyInfo.email}</p>
            </div>
            <div class="invoice-info">
                <h1>INVOICE</h1>
                <p><strong>Invoice #:</strong> ${invoiceData.invoiceNumber}</p>
                <p><strong>Date:</strong> ${invoiceData.invoiceDate}</p>
                <p><strong>Due Date:</strong> ${invoiceData.dueDate}</p>
            </div>
        </div>
        `;
    }

    generateBillingSection(invoiceData) {
        return `
        <div class="billing-section">
            <div style="float: left;">
                <h3>Bill To:</h3>
                <p><strong>${invoiceData.customer.name}</strong></p>
                <p>${invoiceData.customer.address}</p>
                <p>${invoiceData.customer.city}, ${invoiceData.customer.state} ${invoiceData.customer.zip}</p>
                <p>Email: ${invoiceData.customer.email}</p>
            </div>
            <div style="float: right;">
                <h3>Ship To:</h3>
                <p><strong>${invoiceData.shipping ? invoiceData.shipping.name : invoiceData.customer.name}</strong></p>
                <p>${invoiceData.shipping ? invoiceData.shipping.address : invoiceData.customer.address}</p>
                <p>${invoiceData.shipping ? `${invoiceData.shipping.city}, ${invoiceData.shipping.state} ${invoiceData.shipping.zip}` : `${invoiceData.customer.city}, ${invoiceData.customer.state} ${invoiceData.customer.zip}`}</p>
            </div>
            <div style="clear: both;"></div>
        </div>
        `;
    }

    generateItemsTable(invoiceData) {
        let itemsHtml = `
        <table class="items-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
        `;

        for (const item of invoiceData.items) {
            itemsHtml += `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>$${item.unitPrice.toFixed(2)}</td>
                    <td>$${(item.quantity * item.unitPrice).toFixed(2)}</td>
                </tr>
            `;
        }

        itemsHtml += `
            </tbody>
        </table>
        `;

        return itemsHtml;
    }

    generateTotals(invoiceData) {
        return `
        <div class="totals">
            <table>
                <tr>
                    <td><strong>Subtotal:</strong></td>
                    <td>$${invoiceData.subtotal.toFixed(2)}</td>
                </tr>
                ${invoiceData.discount ? `
                <tr>
                    <td><strong>Discount:</strong></td>
                    <td>-$${invoiceData.discount.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr>
                    <td><strong>Tax:</strong></td>
                    <td>$${invoiceData.tax.toFixed(2)}</td>
                </tr>
                <tr style="border-top: 2px solid #333;">
                    <td><strong>Total:</strong></td>
                    <td><strong>$${invoiceData.total.toFixed(2)}</strong></td>
                </tr>
            </table>
        </div>
        `;
    }

    generateFooter(template) {
        return `
        <div class="footer">
            <p>${template.footer}</p>
            <p>Payment Terms: Net 30 days</p>
        </div>
        `;
    }

    getTemplate(templateId) {
        return this.templates.get(templateId);
    }

    listTemplates() {
        return Array.from(this.templates.values());
    }

    deleteTemplate(templateId) {
        if (templateId === this.defaultTemplate) {
            return false;
        }
        return this.templates.delete(templateId);
    }

    setDefaultTemplate(templateId) {
        if (this.templates.has(templateId)) {
            this.defaultTemplate = templateId;
            return true;
        }
        return false;
    }

    cloneTemplate(sourceId, newId, newName) {
        const sourceTemplate = this.templates.get(sourceId);
        if (!sourceTemplate) {
            return null;
        }

        const clonedTemplate = JSON.parse(JSON.stringify(sourceTemplate));
        clonedTemplate.id = newId;
        clonedTemplate.name = newName;

        this.templates.set(newId, clonedTemplate);
        return clonedTemplate;
    }

    updateTemplate(templateId, updates) {
        const template = this.templates.get(templateId);
        if (!template) {
            return null;
        }

        Object.assign(template, updates);
        this.templates.set(templateId, template);
        return template;
    }
}

module.exports = InvoiceTemplate;
