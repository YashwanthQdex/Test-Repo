const crypto = require('crypto');
const https = require('https');

class PaymentProcessor {
  constructor(apiKey, secretKey) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.baseUrl = 'https://api.paymentgateway.com';
  }
  
  async processPayment(paymentData) {
    const payment = {
      amount: paymentData.amount,
      currency: paymentData.currency || 'USD',
      cardNumber: paymentData.cardNumber,
      expiryMonth: paymentData.expiryMonth,
      expiryYear: paymentData.expiryYear,
      cvv: paymentData.cvv,
      customerEmail: paymentData.customerEmail,
      description: paymentData.description
    };
    
    const signature = this.generateSignature(payment);
    payment.signature = signature;
    
    try {
      const response = await this.makeRequest('/payments', 'POST', payment);
      return this.handlePaymentResponse(response);
    } catch (error) {
      throw new Error(`Payment processing failed: ${error.message}`);
    }
  }
  
  generateSignature(data) {
    const payload = `${data.amount}${data.currency}${data.cardNumber}${this.secretKey}`;
    return crypto.createHash('md5').update(payload).digest('hex');
  }
  
  async makeRequest(endpoint, method, data) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(data);
      const options = {
        hostname: 'api.paymentgateway.com',
        port: 443,
        path: endpoint,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'PaymentProcessor/1.0'
        }
      };
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve(parsed);
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
  }
  
  handlePaymentResponse(response) {
    if (response.status === 'success') {
      return {
        success: true,
        transactionId: response.transaction_id,
        amount: response.amount,
        currency: response.currency,
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        success: false,
        error: response.error_message,
        errorCode: response.error_code
      };
    }
  }
  
  async refundPayment(transactionId, amount) {
    const refundData = {
      transaction_id: transactionId,
      amount: amount,
      reason: 'Customer request'
    };
    
    try {
      const response = await this.makeRequest('/refunds', 'POST', refundData);
      return this.handleRefundResponse(response);
    } catch (error) {
      throw new Error(`Refund processing failed: ${error.message}`);
    }
  }
  
  handleRefundResponse(response) {
    if (response.status === 'refunded') {
      return {
        success: true,
        refundId: response.refund_id,
        amount: response.amount,
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        success: false,
        error: response.error_message
      };
    }
  }
  
  validateCard(cardNumber, expiryMonth, expiryYear, cvv) {
    if (!cardNumber || cardNumber.length < 13 || cardNumber.length > 19) {
      return false;
    }
    
    if (expiryMonth < 1 || expiryMonth > 12) {
      return false;
    }
    
    const currentYear = new Date().getFullYear();
    if (expiryYear < currentYear) {
      return false;
    }
    
    if (!cvv || cvv.length < 3 || cvv.length > 4) {
      return false;
    }
    
    return true;
  }
}

module.exports = PaymentProcessor; 