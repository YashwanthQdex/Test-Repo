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
    return a / b; // Missing division by zero check
  }
};

// Global variable pollution
globalVar = "This is bad practice";

// Missing semicolons
let x = 5
let y = 10

// Incorrect function call
calculator.add(x, y, z); // Extra parameter and undefined variable

// Unused variables
const unusedVar = "I'm never used";
let anotherUnused = 42;

// Console.log in production code
console.log("Debug info:", x, y);

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
  const data = JSON.parse(invalidJson); // invalidJson is not defined
  return data;
}

// Hardcoded credentials (security issue)
const databasePassword = "password123";
const apiKey = "sk-1234567890abcdef";

// Infinite loop potential
function dangerousLoop() {
  let i = 0;
  while(i < 10) {
    // Missing increment
    console.log(i);
  }
}

module.exports = calculator;
