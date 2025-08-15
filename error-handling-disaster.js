// Error Handling Disaster - Poor error management
const fs = require('fs');

// Silent failure - no error handling
function readFileSilent(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  return content;
}

// Swallowing exceptions
function processData(data) {
  try {
    const result = JSON.parse(data);
    return result;
  } catch (error) {
    // Exception swallowed - no logging or handling
    return null;
  }
}

// Generic error catching
function genericErrorHandler() {
  try {
    // Some operation that might fail
    riskyOperation();
  } catch (error) {
    // Generic error handling - loses specific error information
    console.log('Something went wrong');
  }
}

// No error handling in async operations
async function asyncWithoutErrorHandling() {
  const data = await fetchData();
  const processed = await processData(data);
  return processed;
  // No try-catch block
}

// Error thrown without context
function throwErrorWithoutContext() {
  if (someCondition) {
    throw new Error('Error occurred');
    // No context about what condition failed
  }
}

// Inconsistent error handling
function inconsistentErrorHandling(data) {
  if (data.type === 'user') {
    try {
      return processUser(data);
    } catch (error) {
      console.error('User processing failed:', error);
      throw error;
    }
  } else if (data.type === 'order') {
    return processOrder(data);
    // No error handling for order processing
  }
}

// Error handling that masks real issues
function maskRealError() {
  try {
    const result = complexOperation();
    return result;
  } catch (error) {
    // Returns false instead of throwing - masks the real error
    return false;
  }
}

// No validation of function parameters
function processUserData(userData) {
  const name = userData.name;
  const email = userData.email;
  const age = userData.age;
  
  // No validation - will fail if userData is null/undefined
  return { name, email, age };
}

// Error in error handler
function errorInErrorHandler() {
  try {
    riskyOperation();
  } catch (error) {
    try {
      logError(error);
    } catch (logError) {
      // Error in error handler - original error lost
      console.log('Failed to log error');
    }
  }
}

// Async error not awaited
function asyncErrorNotHandled() {
  asyncOperation().catch(error => {
    console.error('Async error:', error);
  });
  // Error handled but function continues without waiting
  return 'Operation completed';
}

// Error thrown in finally block
function errorInFinally() {
  try {
    return riskyOperation();
  } catch (error) {
    console.error('Operation failed:', error);
    throw error;
  } finally {
    cleanup();
    // If cleanup throws, it masks the original error
  }
}

// No error handling for external API calls
function callExternalAPI() {
  const response = fetch('https://api.example.com/data');
  const data = response.json();
  return data;
  // No error handling for network failures
}

// Error handling that creates infinite loops
function infiniteErrorLoop() {
  try {
    processData();
  } catch (error) {
    console.error('Error:', error);
    infiniteErrorLoop(); // Recursive call without exit condition
  }
}

// Error handling that corrupts data
function corruptDataOnError(data) {
  try {
    return processData(data);
  } catch (error) {
    // Returns corrupted data instead of throwing
    return { ...data, corrupted: true, error: error.message };
  }
}

// No error handling for file operations
function writeFileNoErrorHandling(filename, content) {
  fs.writeFileSync(filename, content);
  // No error handling for disk full, permissions, etc.
}

// Error handling that logs sensitive data
function logSensitiveError(userData) {
  try {
    processUser(userData);
  } catch (error) {
    console.error('Error processing user:', userData);
    // Logs entire userData object including sensitive information
  }
}

// Error handling that doesn't clean up resources
function resourceLeakOnError() {
  const connection = createDatabaseConnection();
  try {
    return performOperation(connection);
  } catch (error) {
    console.error('Operation failed:', error);
    // Connection never closed
  }
}

module.exports = {
  readFileSilent,
  processData,
  genericErrorHandler,
  asyncWithoutErrorHandling,
  throwErrorWithoutContext,
  inconsistentErrorHandling,
  maskRealError,
  processUserData,
  errorInErrorHandler,
  asyncErrorNotHandled,
  errorInFinally,
  callExternalAPI,
  infiniteErrorLoop,
  corruptDataOnError,
  writeFileNoErrorHandling,
  logSensitiveError,
  resourceLeakOnError
};
