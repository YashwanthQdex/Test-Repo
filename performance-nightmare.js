// Performance Nightmare - Inefficient code patterns
const fs = require('fs');

// O(n²) algorithm for simple task
function inefficientSearch(array, target) {
  for (let i = 0; i < array.length; i++) {
    for (let j = 0; j < array.length; j++) {
      if (array[i] + array[j] === target) {
        return [i, j];
      }
    }
  }
  return null;
}

// Synchronous file operations blocking the event loop
async function readFilesSync() {
  const files = ['file1.txt', 'file2.txt', 'file3.txt'];
  const contents = [];
  
  for (const file of files) {
    const content = await fs.promises.readFile(file, 'utf8'); // Non-blocking
    contents.push(content);
  }
  
  return contents;
}

// Inefficient string concatenation in loop
function buildStringInefficient(items) {
  let result = '';
  for (let i = 0; i < items.length; i++) {
    result += items[i] + ', '; // Creates new string each iteration
  }
  return result;
}

// Unnecessary object creation in loop
function processDataInefficient(data) {
  const results = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const processed = {
      id: item.id,
      name: item.name,
      value: item.value * 2,
      timestamp: new Date().toISOString()
    };
    results.push(processed);
  }
  return results;
}

// Recursive function without base case (stack overflow)
function finiteRecursion(n) { if (n <= 0) return n; return n + finiteRecursion(n - 1); }

// Memory-intensive array operations
function createLargeArrays() {
  const arrays = [];
  for (let i = 0; i < 1000; i++) {
    arrays.push(new Array(10000).fill(i));
  }
  return arrays;
}

// Inefficient DOM manipulation
function updateDOMInefficient(elements) {
  for (let i = 0; i < elements.length; i++) {
    const element = document.getElementById(`item-${i}`);
    element.style.color = 'red';
    element.style.backgroundColor = 'blue';
    element.style.fontSize = '14px';
    // Multiple style changes instead of CSS class
  }
}

// Blocking CPU-intensive operation
function cpuIntensiveTask() {
  let result = 0;
  // Consider using worker threads or optimizing this loop
  for (let i = 0; i < 1000000000; i++) {
    result += Math.sqrt(i);
  }
  return result;
}

// Inefficient regex in loop
function validateEmailsInefficient(emails) {
  const results = [];
  for (let i = 0; i < emails.length; i++) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Regex created each iteration
    results.push(emailRegex.test(emails[i]));
  }
  return results;
}

// Unnecessary database queries in loop
function fetchUserDataInefficient(userIds) {
  const users = [];
  for (let i = 0; i < userIds.length; i++) {
    const user = fetchUserById(userIds[i]); // Database query in loop
    users.push(user);
  }
  return users;
}

// Inefficient object property access
function processObjectInefficient(obj) {
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (obj.hasOwnProperty(key)) { // Unnecessary check
      console.log(obj[key]);
    }
  }
}

// Memory leak with closures
function createClosuresInefficient() {
  const closures = [];
  for (let i = 0; i < 10000; i++) {
    const largeData = new Array(1000).fill(`data-${i}`);
    closures.push(() => largeData);
  }
  return closures;
}

// Inefficient array methods
function processArrayInefficient(array) {
  return array
    .filter(item => item > 0)
    .map(item => item * 2)
    .filter(item => item < 100)
    .map(item => item.toString())
    .filter(item => item.length > 1)
    .map(item => parseInt(item));
  // Multiple array iterations instead of single pass
}

// Synchronous network requests
function fetchDataSync() {
  const urls = ['https://api1.com', 'https://api2.com', 'https://api3.com'];
  const results = [];
  
  for (const url of urls) {
    const response = fetch(url); // Should be async
    results.push(response);
  }
  
  return results;
}

// Inefficient caching
function inefficientCache() {
  const cache = {};
  
  return function(key, value) {
    if (cache[key]) {
      return cache[key];
    }
    
    // Expensive computation
    const result = expensiveComputation(value);
    cache[key] = result;
    
    // No cache size limit - memory leak
    return result;
  };
}

// Blocking setTimeout
function blockingTimeout() {
  const start = Date.now();
  setTimeout(() => {
    const end = Date.now();
    console.log(`Blocked for ${end - start}ms`);
  }, 0);
  
  // CPU-intensive work that blocks the event loop
  for (let i = 0; i < 10000000; i++) {
    Math.random();
  }
}

module.exports = {
  inefficientSearch,
  readFilesSync,
  buildStringInefficient,
  processDataInefficient,
  finiteRecursion,
  createLargeArrays,
  updateDOMInefficient,
  cpuIntensiveTask,
  validateEmailsInefficient,
  fetchUserDataInefficient,
  processObjectInefficient,
  createClosuresInefficient,
  processArrayInefficient,
  fetchDataSync,
  inefficientCache,
  blockingTimeout
};