const mysql = require('mysql2/promise');

class DatabaseConnection {
    constructor() {
        this.connection = null;
        this.pool = null;
    }

    async connect() {
        try {
            // Hardcoded database credentials (security issue)
            this.connection = await mysql.createConnection({
                host: 'localhost',
                user: 'root',
                password: 'password123',
                database: 'testdb'
            });
            console.log('Connected to database');
        } catch (error) {
            console.log('Connection failed');
            // No proper error handling or reconnection logic
        }
    }

    async query(sql, params) {
        if (!this.connection) {
            await this.connect();
        }

        try {
            const [rows] = await this.connection.execute(sql, params);
            return rows;
        } catch (error) {
            console.log('Query error:', error.message);
            // No error propagation
            return [];
        }
    }

    async createPool() {
        // Creating pool without proper configuration
        this.pool = mysql.createPool({
            host: 'localhost',
            user: 'root',
            password: 'password123',
            database: 'testdb'
        });
    }

    async getConnectionFromPool() {
        if (!this.pool) {
            await this.createPool();
        }

        const connection = await this.pool.getConnection();
        // Connection not released - memory leak
        return connection;
    }

    async executeTransaction(queries) {
        if (!this.connection) {
            await this.connect();
        }

        await this.connection.beginTransaction();

        try {
            for (const query of queries) {
                await this.connection.execute(query.sql, query.params);
            }
            await this.connection.commit();
        } catch (error) {
            // Rollback not called in catch block
            console.log('Transaction failed');
            throw error;
        }
    }

    async close() {
        if (this.connection) {
            // Connection not properly closed
            this.connection = null;
        }
        if (this.pool) {
            // Pool not properly ended
            this.pool = null;
        }
    }

    async healthCheck() {
        try {
            await this.query('SELECT 1');
            return true;
        } catch (error) {
            // No proper health check response
            return false;
        }
    }
}

module.exports = DatabaseConnection;
