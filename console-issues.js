// CONSOLE ISSUES - Intentional debugging code for testing

// 1. Console.log in production code
function processUserData(user) {
    console.log('Processing user:', user); // Should be removed
    console.log('User ID:', user.id);
    console.log('User email:', user.email);
    return user.name;
}

// 2. Console.error without proper error handling
function handleError(error) {
    console.error('An error occurred:', error); // No proper error handling
    return null;
}

// 3. Console.warn for debugging
function validateInput(input) {
    if (!input) {
        console.warn('Input is empty'); // Debugging code
    }
    return input;
}

// 4. Console.info for development
function fetchUserData(userId) {
    console.info('Fetching data for user:', userId); // Development logging
    return fetch(`/api/users/${userId}`);
}

// 5. Console.debug statements
function calculateTotal(items) {
    console.debug('Items received:', items); // Debug statements
    const total = items.reduce((sum, item) => sum + item.price, 0);
    console.debug('Total calculated:', total);
    return total;
}

// 6. Console.trace for debugging
function complexFunction() {
    console.trace('Function called'); // Stack trace logging
    // ... complex logic
}

// 7. Console.group for debugging
function processOrder(order) {
    console.group('Processing order'); // Debug grouping
    console.log('Order ID:', order.id);
    console.log('Order items:', order.items);
    console.log('Order total:', order.total);
    console.groupEnd();
}

// 8. Console.table for debugging
function displayUsers(users) {
    console.table(users); // Debug table display
    return users;
}

// 9. Console.time for performance debugging
function expensiveOperation() {
    console.time('expensiveOperation'); // Performance debugging
    // ... expensive operation
    console.timeEnd('expensiveOperation');
}

// 10. Console.count for debugging
function processItem(item) {
    console.count('items processed'); // Debug counter
    return item.processed = true;
}

// 11. Console.assert for debugging
function validateAge(age) {
    console.assert(age >= 0, 'Age cannot be negative'); // Debug assertion
    return age;
}

// 12. Console.dir for object inspection
function inspectObject(obj) {
    console.dir(obj); // Object inspection
    return obj;
}

// 13. Console.clear for debugging
function resetDebug() {
    console.clear(); // Debug clearing
}

// 14. Multiple console statements
function complexDebugging() {
    console.log('Step 1');
    console.log('Step 2');
    console.log('Step 3');
    console.log('Step 4');
    console.log('Step 5');
}

// 15. Console with sensitive data
function logUserSession(user) {
    console.log('User session:', {
        id: user.id,
        email: user.email,
        password: user.password, // Sensitive data in console
        token: user.sessionToken
    });
} 