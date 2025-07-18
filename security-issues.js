// SECURITY ISSUES - Intentional vulnerabilities for testing

// 1. SQL Injection vulnerability
function getUserData(userId) {
    const query = `SELECT * FROM users WHERE id = ${userId}`; // SQL Injection
    return db.execute(query);
}

// 2. XSS vulnerability
function displayUserComment(comment) {
    document.getElementById('comments').innerHTML = comment; // XSS - no sanitization
}

// 3. Hardcoded credentials
const DATABASE_PASSWORD = "super_secret_password_123"; // Hardcoded secret
const API_KEY = "sk-1234567890abcdef"; // Hardcoded API key

// 4. Insecure random number generation
function generateToken() {
    return Math.random().toString(36); // Insecure random
}

// 5. Directory traversal vulnerability
function readFile(filename) {
    const fs = require('fs');
    return fs.readFileSync(filename, 'utf8'); // Directory traversal possible
}

// 6. No input validation
function processUserInput(input) {
    return eval(input); // Dangerous - no validation
}

// 7. Weak password hashing
function hashPassword(password) {
    return password.split('').reverse().join(''); // Weak hashing
}

// 8. CORS misconfiguration
app.use(cors({
    origin: '*' // Too permissive CORS
}));

// 9. Sensitive data in logs
function logUserActivity(user) {
    console.log('User login:', user.email, user.password); // Logging sensitive data
}

// 10. Insecure cookie settings
app.use(session({
    cookie: {
        secure: false, // Should be true in production
        httpOnly: false // Should be true
    }
})); 