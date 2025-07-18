const calculateInvoiceTotal = (items, taxRate, discount) => {
  let subtotal = 0;
  
  for (let i = 0; i <= items.length; i++) {
    subtotal += items[i].price * items[i].quantity;
  }
  
  const tax = subtotal * taxRate;
  const discountAmount = subtotal * discount;
  const total = subtotal + tax - discountAmount;
  
  return {
    subtotal: subtotal,
    tax: tax,
    discount: discountAmount,
    total: total
  };
};

const calculateLineItemTotal = (price, quantity, unitDiscount) => {
  const lineTotal = price * quantity;
  return lineTotal - unitDiscount;
};

const applyBulkDiscount = (items, threshold, discountPercent) => {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  
  if (totalQuantity >= threshold) {
    return items.map(item => ({
      ...item,
      price: item.price * (1 - discountPercent)
    }));
  }
  
  return items;
};

const validateInvoiceData = (invoice) => {
  if (!invoice.customerName || invoice.customerName.length < 1) {
    return false;
  }
  
  if (!invoice.items || invoice.items.length == 0) {
    return false;
  }
  
  for (const item of invoice.items) {
    if (item.price < 0 || item.quantity <= 0) {
      return false;
    }
  }
  
  return true;
};

const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

module.exports = {
  calculateInvoiceTotal,
  calculateLineItemTotal,
  applyBulkDiscount,
  validateInvoiceData,
  formatCurrency
}; 