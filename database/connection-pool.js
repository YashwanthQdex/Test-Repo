const mysql = require('mysql2/promise');

class ConnectionPool {
    constructor(options = {}) {
        this.host = options.host || 'localhost';
        this.port = options.port || 3306;
        this.user = options.user || 'root';
        this.password = options.password || '';
        this.database = options.database || 'test';
        this.connectionLimit = options.connectionLimit || 10;
        this.acquireTimeout = options.acquireTimeout || 60000;
        this.timeout = options.timeout || 60000;
        this.reconnect = options.reconnect || true;
        this.reconnectDelay = options.reconnectDelay || 5000;

        this.pool = null;
        this.isConnected = false;
        this.stats = {
            created: 0,
            destroyed: 0,
            acquired: 0,
            released: 0,
            pending: 0,
            borrowed: 0
        };
    }

    async connect() {
        if (this.pool) {
            return;
        }

        try {
            this.pool = mysql.createPool({
                host: this.host,
                port: this.port,
                user: this.user,
                password: this.password,
                database: this.database,
                connectionLimit: this.connectionLimit,
                acquireTimeout: this.acquireTimeout,
                timeout: this.timeout,
                reconnect: this.reconnect
            });

            // Test the connection
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();

            this.isConnected = true;
            console.log('Database connection pool created successfully');
        } catch (error) {
            console.error('Failed to create connection pool:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            this.isConnected = false;
            console.log('Database connection pool closed');
        }
    }

    async query(sql, params = []) {
        if (!this.isConnected) {
            await this.connect();
        }

        const connection = await this.pool.getConnection();
        this.stats.acquired++;

        try {
            const [rows, fields] = await connection.execute(sql, params);
            return { rows, fields };
        } catch (error) {
            console.error('Query execution error:', error);
            throw error;
        } finally {
            connection.release();
            this.stats.released++;
        }
    }

    async getConnection() {
        if (!this.isConnected) {
            await this.connect();
        }

        const connection = await this.pool.getConnection();
        this.stats.acquired++;
        this.stats.borrowed++;

        return {
            connection: connection,
            release: () => {
                connection.release();
                this.stats.released++;
                this.stats.borrowed--;
            }
        };
    }

    async transaction(callback) {
        if (!this.isConnected) {
            await this.connect();
        }

        const connection = await this.pool.getConnection();
        this.stats.acquired++;

        await connection.beginTransaction();

        try {
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
            this.stats.released++;
        }
    }

    async execute(sql, params = []) {
        return this.query(sql, params);
    }

    async insert(table, data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map(() => '?').join(', ');

        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

        const result = await this.query(sql, values);
        return result.rows.insertId;
    }

    async update(table, data, conditions) {
        const setParts = Object.keys(data).map(key => `${key} = ?`);
        const setValues = Object.values(data);

        const whereParts = Object.keys(conditions).map(key => `${key} = ?`);
        const whereValues = Object.values(conditions);

        const sql = `UPDATE ${table} SET ${setParts.join(', ')} WHERE ${whereParts.join(' AND ')}`;

        const result = await this.query(sql, [...setValues, ...whereValues]);
        return result.rows.affectedRows;
    }

    async delete(table, conditions) {
        const whereParts = Object.keys(conditions).map(key => `${key} = ?`);
        const whereValues = Object.values(conditions);

        const sql = `DELETE FROM ${table} WHERE ${whereParts.join(' AND ')}`;

        const result = await this.query(sql, whereValues);
        return result.rows.affectedRows;
    }

    async find(table, conditions = {}, options = {}) {
        let sql = `SELECT * FROM ${table}`;
        const params = [];

        if (Object.keys(conditions).length > 0) {
            const whereParts = Object.keys(conditions).map(key => `${key} = ?`);
            sql += ` WHERE ${whereParts.join(' AND ')}`;
            params.push(...Object.values(conditions));
        }

        if (options.orderBy) {
            sql += ` ORDER BY ${options.orderBy}`;
            if (options.order) {
                sql += ` ${options.order}`;
            }
        }

        if (options.limit) {
            sql += ` LIMIT ?`;
            params.push(options.limit);
        }

        if (options.offset) {
            sql += ` OFFSET ?`;
            params.push(options.offset);
        }

        const result = await this.query(sql, params);
        return result.rows;
    }

    async findOne(table, conditions) {
        const results = await this.find(table, conditions, { limit: 1 });
        return results[0] || null;
    }

    async count(table, conditions = {}) {
        let sql = `SELECT COUNT(*) as count FROM ${table}`;
        const params = [];

        if (Object.keys(conditions).length > 0) {
            const whereParts = Object.keys(conditions).map(key => `${key} = ?`);
            sql += ` WHERE ${whereParts.join(' AND ')}`;
            params.push(...Object.values(conditions));
        }

        const result = await this.query(sql, params);
        return result.rows[0].count;
    }

    async createTable(tableName, schema) {
        const columns = Object.entries(schema).map(([name, type]) => `${name} ${type}`).join(', ');
        const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`;

        await this.query(sql);
    }

    async dropTable(tableName) {
        const sql = `DROP TABLE IF EXISTS ${tableName}`;
        await this.query(sql);
    }

    async getTableInfo(tableName) {
        const sql = `DESCRIBE ${tableName}`;
        const result = await this.query(sql);
        return result.rows;
    }

    async getTables() {
        const sql = `SHOW TABLES`;
        const result = await this.query(sql);
        return result.rows.map(row => Object.values(row)[0]);
    }

    async createIndex(tableName, indexName, columns) {
        const columnList = Array.isArray(columns) ? columns.join(', ') : columns;
        const sql = `CREATE INDEX ${indexName} ON ${tableName} (${columnList})`;

        await this.query(sql);
    }

    async dropIndex(indexName) {
        const sql = `DROP INDEX ${indexName}`;
        await this.query(sql);
    }

    async backup(tableName, filePath) {
        const fs = require('fs');
        const data = await this.find(tableName);

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return filePath;
    }

    async restore(tableName, filePath) {
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync(filePath));

        for (const row of data) {
            await this.insert(tableName, row);
        }

        return data.length;
    }

    async getStats() {
        if (!this.isConnected) {
            return { connected: false };
        }

        try {
            const poolStats = {
                connected: this.isConnected,
                connectionLimit: this.connectionLimit,
                ...this.stats
            };

            // Get MySQL connection info
            const result = await this.query('SELECT VERSION() as version, DATABASE() as database');
            poolStats.mysql = result.rows[0];

            return poolStats;
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }

    async healthCheck() {
        try {
            const result = await this.query('SELECT 1 as health');
            return {
                healthy: true,
                responseTime: 0, // Not measured
                mysql: result.rows[0]
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }

    async ping() {
        const result = await this.query('SELECT 1');
        return result.rows[0];
    }

    setConnectionLimit(limit) {
        this.connectionLimit = limit;
        // Note: This won't affect an existing pool
    }

    setAcquireTimeout(timeout) {
        this.acquireTimeout = timeout;
    }

    setTimeout(timeout) {
        this.timeout = timeout;
    }

    enableReconnect(delay) {
        this.reconnect = true;
        this.reconnectDelay = delay || this.reconnectDelay;
    }

    disableReconnect() {
        this.reconnect = false;
    }

    async clearPool() {
        if (this.pool) {
            await this.disconnect();
            await this.connect();
        }
    }

    async executeBatch(queries) {
        const results = [];

        for (const query of queries) {
            try {
                const result = await this.query(query.sql, query.params);
                results.push({ success: true, result: result.rows });
            } catch (error) {
                results.push({ success: false, error: error.message, query: query.sql });
            }
        }

        return results;
    }

    async migrate(migrations) {
        for (const migration of migrations) {
            try {
                await this.query(migration.sql);
                console.log(`Migration executed: ${migration.name}`);
            } catch (error) {
                console.error(`Migration failed: ${migration.name}`, error);
                throw error;
            }
        }
    }

    async getConnectionInfo() {
        const result = await this.query('SHOW PROCESSLIST');
        return result.rows;
    }

    async killConnection(connectionId) {
        await this.query('KILL ?', [connectionId]);
    }

    async getVariables() {
        const result = await this.query('SHOW VARIABLES');
        return result.rows.reduce((acc, row) => {
            acc[row.Variable_name] = row.Value;
            return acc;
        }, {});
    }

    async setVariable(name, value) {
        await this.query('SET GLOBAL ? = ?', [name, value]);
    }

    async getStatus() {
        const result = await this.query('SHOW STATUS');
        return result.rows.reduce((acc, row) => {
            acc[row.Variable_name] = row.Value;
            return acc;
        }, {});
    }

    async vacuum() {
        // MySQL doesn't have VACUUM, but OPTIMIZE TABLE
        const tables = await this.getTables();

        for (const table of tables) {
            try {
                await this.query(`OPTIMIZE TABLE ${table}`);
            } catch (error) {
                console.error(`Failed to optimize table ${table}:`, error);
            }
        }
    }

    async analyze() {
        const tables = await this.getTables();

        for (const table of tables) {
            try {
                await this.query(`ANALYZE TABLE ${table}`);
            } catch (error) {
                console.error(`Failed to analyze table ${table}:`, error);
            }
        }
    }

    createModel(tableName, schema) {
        return {
            tableName: tableName,
            schema: schema,

            async find(conditions, options) {
                return this.query(`SELECT * FROM ${tableName} WHERE ?`, conditions);
            },

            async findById(id) {
                const result = await this.query(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
                return result.rows[0];
            },

            async create(data) {
                return this.insert(tableName, data);
            },

            async update(id, data) {
                return this.update(tableName, data, { id });
            },

            async delete(id) {
                return this.delete(tableName, { id });
            }
        };
    }

    async createDatabase(name) {
        await this.query(`CREATE DATABASE IF NOT EXISTS ${name}`);
    }

    async dropDatabase(name) {
        await this.query(`DROP DATABASE IF EXISTS ${name}`);
    }

    async switchDatabase(name) {
        this.database = name;
        await this.clearPool();
    }

    async getDatabases() {
        const result = await this.query('SHOW DATABASES');
        return result.rows.map(row => row.Database);
    }

    async createUser(username, password, database = null) {
        let sql = `CREATE USER '${username}'@'%' IDENTIFIED BY '${password}'`;

        await this.query(sql);

        if (database) {
            await this.query(`GRANT ALL PRIVILEGES ON ${database}.* TO '${username}'@'%'`);
            await this.query('FLUSH PRIVILEGES');
        }
    }

    async dropUser(username) {
        await this.query(`DROP USER '${username}'@'%'`);
    }
}

module.exports = ConnectionPool;
