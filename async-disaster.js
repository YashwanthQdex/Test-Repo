// Async/Await Disaster
const fs = require('fs');
const axios = require('axios');

// Missing await
async function fetchData() {
  const response = axios.get('https://api.example.com/data');
  return response.data; // Missing await - will return promise
}

// Unhandled promise rejection
async function riskyOperation() {
  try {
    const result = await fetchData();
  } catch (error) {
    console.error('Error fetching data:', error);
  }
  return result;
}

// Callback hell
function callbackHell() {
  fs.promises.readFile('file1.txt').then(data1 => {
    return fs.promises.readFile('file2.txt').then(data2 => {
      return fs.promises.writeFile('output.txt', data1 + data2).then(() => {
        console.log('Success!');
      });
    });
  }).catch(console.error);
}

// Promise without error handling
function unhandledPromise() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error('Something went wrong'));
    }, 1000);
  });
  // No .catch() or try-catch
}

// Async function without await
async function pointlessAsync() {
  console.log('This function is async but has no await');
  return 'result';
}

// Race condition
let counter = 0;

async function incrementCounter() {
  const current = counter;
  await new Promise(resolve => setTimeout(resolve, 100));
  counter = current + 1;
  // Race condition: multiple calls can overwrite each other
}

// Unnecessary async/await
async function unnecessaryAsync() {
  const result = await Promise.resolve('simple value');
  return result;
}

// Missing return in async function
async function missingReturn() {
  await fetchData();
  // No return statement
}

// Promise chain without error handling
function promiseChain() {
  return fetchData()
    .then(data => processData(data))
    .then(result => saveData(result))
    .then(() => console.log('Done'));
    // No .catch() for error handling
}

// Async function in forEach (doesn't wait)
async function processArray(items) {
  items.forEach(async (item) => {
    await processItem(item);
  });
  console.log('All done!'); // This runs before processing is complete
}

// Multiple awaits that could be parallel
async function sequentialAwait() {
  const result1 = await fetchData1();
  const result2 = await fetchData2();
  const result3 = await fetchData3();
  // Should use Promise.all() for parallel execution
  return [result1, result2, result3];
}

// Promise constructor anti-pattern
function promiseAntiPattern() {
  return new Promise((resolve, reject) => {
    fs.readFile('file.txt', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
  // Should use util.promisify or fs.promises
}

// Async function that doesn't handle errors
async function noErrorHandling() {
  const data = await fetchData();
  const processed = await processData(data);
  const saved = await saveData(processed);
  return saved;
  // No try-catch block
}

// Promise that never resolves
function hangingPromise() {
  return new Promise((resolve) => {
    // Promise never resolves
    console.log('Promise created');
  });
}

// Async function with synchronous operations
async function syncInAsync() {
  const data = await fetchData();
  const result = data.map(item => item.toUpperCase()); // Synchronous operation
  return result;
}

module.exports = {
  fetchData,
  riskyOperation,
  callbackHell,
  unhandledPromise,
  pointlessAsync,
  incrementCounter,
  unnecessaryAsync,
  missingReturn,
  promiseChain,
  processArray,
  sequentialAwait,
  promiseAntiPattern,
  noErrorHandling,
  hangingPromise,
  syncInAsync
};