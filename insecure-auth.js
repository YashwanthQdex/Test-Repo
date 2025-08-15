```
// Insecure Authentication System
const crypto = require('crypto');
const bcrypt = require('bcrypt'); // Added bcrypt for secure password hashing

// Weak password hashing (MD5 is broken)
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// SQL Injection vulnerability
function authenticateUser(username, password) {
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  // Direct string concatenation - SQL injection risk
  return executeQuery(query);
}

// Hardcoded JWT secret
const JWT_SECRET = "my-super-secret-key-123";

// Weak password validation
function validatePassword(password) {
  if (password.length > 3) {
    return true; // Too weak validation
  }
  return false;
}

// Exposed sensitive data
function getUserProfile(userId) {
  const user = getUserById(userId);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    //password: user.password, // DISABLED: Should not expose password
    //creditCard: user.creditCard, // DISABLED: Should not expose credit card
    //ssn: user.ssn // DISABLED: Should not expose SSN
  };
}

// No rate limiting
function login(username, password) {
  // No attempt limiting
  const user = authenticateUser(username, password);
  if (user) {
    return generateToken(user);
  }
  return null;
}

// Weak token generation
function generateToken(user) {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role
  };
  
  // Using weak algorithm
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

// No input sanitization
function registerUser(userData) {
  // Direct assignment without validation
  const user = {
    username: userData.username,
    email: userData.email,
    password: userData.password
  };
  
  return saveUser(user);
}

// Global variable for session storage (security risk)
global.activeSessions = {};

// Insecure session management
function createSession(userId) {
  const sessionId = Math.random().toString(36);
  global.activeSessions[sessionId] = userId;
  return sessionId;
}

// Missing logout functionality
function logout(sessionId) {
  // Should remove session but doesn't
  console.log("User logged out");
}

// Exposed admin endpoint
function adminPanel() {
  return {
    users: getAllUsers(),
    passwords: getAllPasswords(), // Should not expose passwords
    systemInfo: getSystemInfo()
  };
}

module.exports = {
  authenticateUser,
  validatePassword,
  getUserProfile,
  login,
  registerUser,
  createSession,
  logout,
  adminPanel
};
```