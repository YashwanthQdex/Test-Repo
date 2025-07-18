// LOGIC ISSUES - Intentional bugs for testing

// 1. Infinite loop potential
function calculateFactorial(n) {
    if (n <= 1) return 1;
    return n * calculateFactorial(n); // Should be n-1
}

// 2. Off-by-one error
function processArray(arr) {
    for (let i = 0; i <= arr.length; i++) { // Should be < not <=
        console.log(arr[i]);
    }
}

// 3. Race condition
let counter = 0;
function incrementCounter() {
    counter++; // Not atomic
}

// 4. Memory leak
function createObjects() {
    const objects = [];
    setInterval(() => {
        objects.push({ data: 'some data' }); // Never cleared
    }, 1000);
}

// 5. Dead code
function unusedFunction() {
    console.log('This will never be called');
    return 'unused';
}

// 6. Incorrect boolean logic
function isValidAge(age) {
    return age > 18 && age < 65; // Should be >= and <=
}

// 7. Null pointer dereference
function processUser(user) {
    return user.name.toUpperCase(); // No null check
}

// 8. Incorrect string comparison
function checkPassword(password) {
    return password == "admin123"; // Should use ===
}

// 9. Division by zero potential
function calculateAverage(numbers) {
    const sum = numbers.reduce((a, b) => a + b, 0);
    return sum / numbers.length; // No check for empty array
}

// 10. Incorrect date handling
function isExpired(date) {
    return new Date() > date; // Should compare with current date properly
}

// 11. Unreachable code
function processData(data) {
    if (data) {
        return process(data);
    }
    return null;
    console.log('This will never execute'); // Unreachable
}

// 12. Incorrect async handling
async function fetchData() {
    const response = await fetch('/api/data');
    return response.json(); // No error handling
}

// 13. Incorrect object property access
function getUserProperty(user, property) {
    return user[property]; // No validation of property name
}

// 14. Incorrect array manipulation
function removeItem(arr, item) {
    const index = arr.indexOf(item);
    arr.splice(index, 1); // No check if item exists
}

// 15. Incorrect type checking
function processValue(value) {
    if (typeof value === 'string') {
        return value.toUpperCase();
    }
    return value.toString(); // No null/undefined check
} 