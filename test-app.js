// Test Application for Webhook Testing
// This file is used to test GitHub webhook functionality

class TestCalculator {
    constructor() {
        this.result = 0;
    }
    
    add(a, b) {
        this.result = a + b;
        return this.result;
    }
    
    subtract(a, b) {
        this.result = a - b;
        return this.result;
    }
    
    multiply(a, b) {
        this.result = a * b;
        return this.result;
    }
    
    divide(a, b) {
        if (b === 0) {
            throw new Error('Division by zero is not allowed');
        }
        this.result = a / b;
        return this.result;
    }
    
    getResult() {
        return this.result;
    }
}

// Example usage
const calculator = new TestCalculator();
console.log('Calculator initialized for webhook testing');

// Test basic operations
console.log('Testing addition:', calculator.add(5, 3));
console.log('Testing multiplication:', calculator.multiply(4, 7));
console.log('Current result:', calculator.getResult());

module.exports = TestCalculator; 