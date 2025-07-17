// Test Application for Webhook Testing
// This file is used to test GitHub webhook functionality
// Updated: Added new features for webhook testing

class TestCalculator {
    constructor() {
        this.result = 0;
        this.history = []; // Added history tracking
    }
    
    add(a, b) {
        this.result = a + b;
        this.history.push(`Added ${a} + ${b} = ${this.result}`);
        return this.result;
    }
    
    subtract(a, b) {
        this.result = a - b;
        this.history.push(`Subtracted ${a} - ${b} = ${this.result}`);
        return this.result;
    }
    
    multiply(a, b) {
        this.result = a * b;
        this.history.push(`Multiplied ${a} * ${b} = ${this.result}`);
        return this.result;
    }
    
    divide(a, b) {
        if (b === 0) {
            throw new Error('Division by zero is not allowed');
        }
        this.result = a / b;
        this.history.push(`Divided ${a} / ${b} = ${this.result}`);
        return this.result;
    }
    
    // NEW METHOD: Power function for webhook testing
    power(base, exponent) {
        this.result = Math.pow(base, exponent);
        this.history.push(`Power ${base}^${exponent} = ${this.result}`);
        return this.result;
    }
    
    // NEW METHOD: Get calculation history
    getHistory() {
        return this.history;
    }
    
    // NEW METHOD: Clear history
    clearHistory() {
        this.history = [];
        return 'History cleared';
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
console.log('Testing new power function:', calculator.power(2, 8));
console.log('Current result:', calculator.getResult());
console.log('Calculation history:', calculator.getHistory());

module.exports = TestCalculator; 