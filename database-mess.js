// Database Mess - Connection leaks and poor practices
const mysql = require('mysql');

// Global connection pool (bad practice)
let connection;

// Connection without proper configuration
function createConnection() {
  connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password123', // Hardcoded password
    database: 'testdb'
  });
  return connection;
}

// Connection leak - never closing connections
function queryData(query) {
  const conn = createConnection();
  conn.query(query, (error, results) => {
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Results:', results);
    }
    // Connection never closed
  });
}

// SQL Injection vulnerability
function getUserByUsername(username) {
  const query = `SELECT * FROM users WHERE username = '${username}'`;
  // Direct string concatenation - SQL injection risk
  return executeQuery(query);
}

// Multiple connections without pooling
function processMultipleQueries() {
  const conn1 = createConnection();
  const conn2 = createConnection();
  const conn3 = createConnection();
  
  // All connections remain open
  conn1.query('SELECT * FROM table1');
  conn2.query('SELECT * FROM table2');
  conn3.query('SELECT * FROM table3');
}

// No error handling in queries
function unsafeQuery(sql) {
  connection.query(sql, (results) => {
    console.log(results);
    // No error handling
  });
}

// Transaction without proper handling
function unsafeTransaction() {
  connection.beginTransaction();
  
  connection.query('INSERT INTO table1 VALUES (1, "data")', (err) => {
    if (err) {
      console.error(err);
      // No rollback
    }
  });
  
  connection.query('INSERT INTO table2 VALUES (1, "data")', (err) => {
    if (err) {
      console.error(err);
      // No rollback
    } else {
      connection.commit();
    }
  });
}

// Connection timeout issues
function longRunningQuery() {
  const conn = createConnection();
  conn.query('SELECT SLEEP(30)', (error, results) => {
    // Query takes 30 seconds, connection might timeout
    console.log(results);
  });
  // Connection not closed
}

// No connection pooling
function inefficientQueries() {
  for (let i = 0; i < 100; i++) {
    const conn = createConnection();
    conn.query(`SELECT * FROM users WHERE id = ${i}`, (error, results) => {
      console.log(results);
    });
    // 100 connections created, none closed
  }
}

// Missing parameter validation
function insertUser(userData) {
  const query = `INSERT INTO users (name, email, age) VALUES ('${userData.name}', '${userData.email}', ${userData.age})`;
  // No validation of userData
  return executeQuery(query);
}

// No connection error handling
function connectWithoutErrorHandling() {
  const conn = createConnection();
  conn.connect();
  // No error event listener
}

// Query with callback hell
function complexQuery() {
  const conn = createConnection();
  conn.query('SELECT * FROM users', (err1, users) => {
    if (err1) {
      console.error(err1);
    } else {
      conn.query('SELECT * FROM orders', (err2, orders) => {
        if (err2) {
          console.error(err2);
        } else {
          conn.query('SELECT * FROM products', (err3, products) => {
            if (err3) {
              console.error(err3);
            } else {
              console.log('All data:', { users, orders, products });
            }
          });
        }
      });
    }
  });
}

// No connection limits
function unlimitedConnections() {
  const connections = [];
  for (let i = 0; i < 1000; i++) {
    connections.push(createConnection());
  }
  // 1000 connections created, none closed
}

// Hardcoded database credentials
const DB_CONFIG = {
  host: 'localhost',
  user: 'admin',
  password: 'admin123',
  database: 'production_db'
};

// Connection without SSL
function insecureConnection() {
  return mysql.createConnection({
    host: 'remote-server.com',
    user: 'user',
    password: 'pass',
    database: 'db',
    // No SSL configuration
  });
}

// No query timeout
function noTimeoutQuery() {
  const conn = createConnection();
  conn.query({
    sql: 'SELECT * FROM large_table',
    timeout: 0 // No timeout
  }, (error, results) => {
    console.log(results);
  });
}

module.exports = {
  createConnection,
  queryData,
  getUserByUsername,
  processMultipleQueries,
  unsafeQuery,
  unsafeTransaction,
  longRunningQuery,
  inefficientQueries,
  insertUser,
  connectWithoutErrorHandling,
  complexQuery,
  unlimitedConnections,
  insecureConnection,
  noTimeoutQuery
};
