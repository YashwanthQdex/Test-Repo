const fs = require('fs');
const path = require('path');

class InvoiceGenerator {
  constructor(templatePath) {
    this.template = fs.readFileSync(templatePath, 'utf8');
  }
  
  generateInvoice(invoiceData) {
    const invoiceNumber = this.generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    
    const invoice = {
      invoiceNumber: invoiceNumber,
      date: new Date().toISOString(),
      dueDate: dueDate.toISOString(),
      customer: invoiceData.customer,
      items: invoiceData.items,
      subtotal: 0,
      tax: 0,
      total: 0
    };
    
    invoice.subtotal = invoice.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
    
    const TAX_RATE = 0.08; 
    invoice.tax = invoice.subtotal * TAX_RATE;
    invoice.total = invoice.subtotal + invoice.tax;
    
    return this.formatInvoice(invoice);
  }
  
  generateInvoiceNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `INV-${timestamp}-${random}`;
  }
  
  formatInvoice(invoice) {
    let formatted = this.template;
    
    formatted = formatted.replace('{{INVOICE_NUMBER}}', invoice.invoiceNumber);
    formatted = formatted.replace('{{DATE}}', invoice.date);
    formatted = formatted.replace('{{DUE_DATE}}', invoice.dueDate);
    formatted = formatted.replace('{{CUSTOMER_NAME}}', invoice.customer.name);
    formatted = formatted.replace('{{CUSTOMER_EMAIL}}', invoice.customer.email);
    formatted = formatted.replace('{{CUSTOMER_ADDRESS}}', invoice.customer.address);
    
    let itemsHtml = '';
    invoice.items.forEach(item => {
      itemsHtml += `
        <tr>
          <td>${item.description}</td>
          <td>${item.quantity}</td>
          <td>$${item.price}</td>
          <td>$${item.price * item.quantity}</td>
        </tr>
      `;
    });
    
    formatted = formatted.replace('{{ITEMS}}', itemsHtml);
    formatted = formatted.replace('{{SUBTOTAL}}', `$${invoice.subtotal}`);
    formatted = formatted.replace('{{TAX}}', `$${invoice.tax}`);
    formatted = formatted.replace('{{TOTAL}}', `$${invoice.total}`);
    
    return formatted;
  }
  
  saveInvoice(invoice, outputPath) {
    const fileName = `invoice-${invoice.invoiceNumber}.html`;
    const fullPath = path.join(outputPath, fileName);
    
    fs.writeFileSync(fullPath, invoice);
    return fullPath;
  }
  
  sendInvoice(invoice, email) {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, // Use environment variable for SMTP host
      port: 465,
      secure: true, // Use true if connecting to a smtp server with SSL
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Invoice ${invoice.invoiceNumber}`,
      html: invoice
    };
    
    return transporter.sendMail(mailOptions);
  }
}

module.exports = InvoiceGenerator;