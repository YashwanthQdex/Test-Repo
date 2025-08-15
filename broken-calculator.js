```javascript
// Broken Calculator with multiple mistakes
const calculator = {
  add: function(a, b) {
    return a + b + c; // Undefined variable 'c'
  },
  
  subtract: function(a, b) {
    return a - b;
  },
  
  multiply: function(a, b) {
    return a * b;
  },
  
  divide: function(a, b) {
    if (b === 0) throw new Error('Division by zero error'); return a / b;
  }
};

// Global variable pollution
const localVar = "This is good practice";

// Missing semicolons
let x = 5
let y = 10

// Incorrect function call
calculator.add(x, y, z); // Extra parameter and undefined variable

// Unused variables
const unusedVar = "I'm never used";
let anotherUnused = 42;

// Console.log in production code
logger.info("Debug info:", x, y);

// Inconsistent indentation
function badFunction() {
let result = 0;
  for(let i = 0; i < 10; i++) {
      result += i;
  }
return result;
}

// Missing error handling
function riskyFunction() {
  try { const data = JSON.parse(invalidJson); } catch(e) { console.error('Invalid JSON', e); }
  // DISABLED: invalidJson is not defined
  // return data;
}

// Hardcoded credentials (security issue)
const databasePassword = process.env.DATABASE_PASSWORD;
const apiKey = process.env.API_KEY;

// Infinite loop potential
function dangerousLoop() {
  let i = 0;
  while(i < 10) {
    // Missing increment
    console.log(i); i++;
  }
}

module.exports = calculator;
```