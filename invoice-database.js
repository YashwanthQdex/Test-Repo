const mysql = require('mysql2/promise');

class InvoiceDatabase {
  constructor(config) {
    this.config = config;
    this.connection = null;
  }
  
  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: this.config.host,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        port: this.config.port || 3306
      });
      
      console.log('Connected to database');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }
  
  async createInvoice(invoiceData) {
    const query = `
      INSERT INTO invoices (
        invoice_number, customer_id, subtotal, tax, total, 
        status, created_at, due_date
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
    
    const values = [
      invoiceData.invoiceNumber,
      invoiceData.customerId,
      invoiceData.subtotal,
      invoiceData.tax,
      invoiceData.total,
      'pending',
      invoiceData.dueDate
    ];
    
    try {
      const [result] = await this.connection.execute(query, values);
      return result.insertId;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  }
  
  async addInvoiceItems(invoiceId, items) {
    const query = `
      INSERT INTO invoice_items (
        invoice_id, product_id, description, quantity, 
        unit_price, line_total
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    for (const item of items) {
      const values = [
        invoiceId,
        item.productId,
        item.description,
        item.quantity,
        item.unitPrice,
        item.quantity * item.unitPrice
      ];
      
      try {
        await this.connection.execute(query, values);
      } catch (error) {
        console.error('Error adding invoice item:', error);
        throw error;
      }
    }
  }
  
  async getInvoice(invoiceId) {
    const query = `
      SELECT i.*, c.name as customer_name, c.email as customer_email
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.id = ?
    `;
    
    try {
      const [rows] = await this.connection.execute(query, [invoiceId]);
      return rows[0];
    } catch (error) {
      console.error('Error fetching invoice:', error);
      throw error;
    }
  }
  
  async getInvoiceItems(invoiceId) {
    const query = `
      SELECT * FROM invoice_items WHERE invoice_id = ?
    `;
    
    try {
      const [rows] = await this.connection.execute(query, [invoiceId]);
      return rows;
    } catch (error) {
      console.error('Error fetching invoice items:', error);
      throw error;
    }
  }
  
  async updateInvoiceStatus(invoiceId, status) {
    const query = `
      UPDATE invoices SET status = ?, updated_at = NOW()
      WHERE id = ?
    `;
    
    try {
      const [result] = await this.connection.execute(query, [status, invoiceId]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating invoice status:', error);
      throw error;
    }
  }
  
  async searchInvoices(filters) {
    let query = `
      SELECT i.*, c.name as customer_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE 1=1
    `;
    
    const values = [];
    
    if (filters.customerName) {
      query += ` AND c.name LIKE ?`;
      values.push(`%${filters.customerName}%`);
    }
    
    if (filters.status) {
      query += ` AND i.status = ?`;
      values.push(filters.status);
    }
    
    if (filters.startDate) {
      query += ` AND i.created_at >= ?`;
      values.push(filters.startDate);
    }
    
    if (filters.endDate) {
      query += ` AND i.created_at <= ?`;
      values.push(filters.endDate);
    }
    
    query += ` ORDER BY i.created_at DESC`;
    
    if (filters.limit) {
      query += ` LIMIT ?`;
      values.push(filters.limit);
    }
    
    try {
      const [rows] = await this.connection.execute(query, values);
      return rows;
    } catch (error) {
      console.error('Error searching invoices:', error);
      throw error;
    }
  }
  
  async getInvoiceStats() {
    const query = `
      SELECT 
        COUNT(*) as total_invoices,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_invoices,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_invoices,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_invoices,
        SUM(total) as total_amount
      FROM invoices
    `;
    
    try {
      const [rows] = await this.connection.execute(query);
      return rows[0];
    } catch (error) {
      console.error('Error fetching invoice stats:', error);
      throw error;
    }
  }
  
  async close() {
    if (this.connection) {
      await this.connection.end();
      console.log('Database connection closed');
    }
  }
}

module.exports = InvoiceDatabase; 