const fs = require('fs');
const path = require('path');

class DatabaseMigrations {
    constructor(options = {}) {
        this.migrationsPath = options.migrationsPath || './database/migrations';
        this.executedMigrations = new Set();
        this.migrationHistory = [];
        this.connection = options.connection || null;
        this.lockFile = './database/.migration_lock';
        this.backupBeforeMigration = options.backupBeforeMigration || false;
    }

    async initialize() {
        await this.createMigrationsDirectory();
        await this.loadExecutedMigrations();
    }

    async createMigrationsDirectory() {
        if (!fs.existsSync(this.migrationsPath)) {
            fs.mkdirSync(this.migrationsPath, { recursive: true });
        }
    }

    async loadExecutedMigrations() {
        try {
            const historyFile = path.join(this.migrationsPath, 'history.json');
            if (fs.existsSync(historyFile)) {
                const data = fs.readFileSync(historyFile, 'utf8');
                const history = JSON.parse(data);
                this.executedMigrations = new Set(history.executed);
                this.migrationHistory = history.records || [];
            }
        } catch (error) {
            console.log('No migration history found, starting fresh');
        }
    }

    async createMigration(name, description = '') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${timestamp}_${name}.js`;
        const filePath = path.join(this.migrationsPath, fileName);

        const template = `
const Migration = {
    name: '${name}',
    description: '${description}',

    async up(db) {
        // Migration logic goes here
        console.log('Running migration: ${name}');

        // Example:
        // await db.query('CREATE TABLE example (id INT PRIMARY KEY, name VARCHAR(255))');
    },

    async down(db) {
        // Rollback logic goes here
        console.log('Rolling back migration: ${name}');

        // Example:
        // await db.query('DROP TABLE example');
    }
};

module.exports = Migration;
`;

        fs.writeFileSync(filePath, template);
        console.log(`Created migration: ${fileName}`);
        return filePath;
    }

    async runMigrations() {
        const lockAcquired = await this.acquireLock();
        if (!lockAcquired) {
            throw new Error('Migration lock could not be acquired');
        }

        try {
            if (this.backupBeforeMigration) {
                await this.createBackup();
            }

            const migrations = await this.getPendingMigrations();

            if (migrations.length === 0) {
                console.log('No pending migrations');
                return;
            }

            for (const migration of migrations) {
                await this.executeMigration(migration);
            }

            await this.saveMigrationHistory();
            console.log(`Executed ${migrations.length} migrations`);
        } finally {
            await this.releaseLock();
        }
    }

    async executeMigration(migration) {
        console.log(`Executing migration: ${migration.name}`);

        try {
            if (migration.up) {
                await migration.up(this.connection);
            }

            this.executedMigrations.add(migration.fileName);
            this.migrationHistory.push({
                name: migration.name,
                fileName: migration.fileName,
                executedAt: new Date(),
                status: 'success'
            });
        } catch (error) {
            console.error(`Migration failed: ${migration.name}`, error);

            this.migrationHistory.push({
                name: migration.name,
                fileName: migration.fileName,
                executedAt: new Date(),
                status: 'failed',
                error: error.message
            });

            // Don't continue with other migrations
            throw error;
        }
    }

    async rollbackMigrations(steps = 1) {
        const lockAcquired = await this.acquireLock();
        if (!lockAcquired) {
            throw new Error('Migration lock could not be acquired');
        }

        try {
            const executedMigrations = this.migrationHistory
                .filter(m => m.status === 'success')
                .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))
                .slice(0, steps);

            for (const record of executedMigrations) {
                await this.rollbackMigration(record);
            }

            await this.saveMigrationHistory();
            console.log(`Rolled back ${executedMigrations.length} migrations`);
        } finally {
            await this.releaseLock();
        }
    }

    async rollbackMigration(record) {
        const migrationFile = path.join(this.migrationsPath, record.fileName);

        if (!fs.existsSync(migrationFile)) {
            throw new Error(`Migration file not found: ${record.fileName}`);
        }

        const migration = require(migrationFile);

        console.log(`Rolling back migration: ${record.name}`);

        try {
            if (migration.down) {
                await migration.down(this.connection);
            }

            this.executedMigrations.delete(record.fileName);
            record.status = 'rolled_back';
            record.rolledBackAt = new Date();
        } catch (error) {
            console.error(`Rollback failed: ${record.name}`, error);
            record.status = 'rollback_failed';
            record.rollbackError = error.message;
            throw error;
        }
    }

    async getPendingMigrations() {
        const migrationFiles = fs.readdirSync(this.migrationsPath)
            .filter(file => file.endsWith('.js') && file !== 'history.json')
            .sort();

        const pendingMigrations = [];

        for (const file of migrationFiles) {
            if (!this.executedMigrations.has(file)) {
                const filePath = path.join(this.migrationsPath, file);
                const migration = require(filePath);
                pendingMigrations.push({
                    ...migration,
                    fileName: file,
                    filePath: filePath
                });
            }
        }

        return pendingMigrations;
    }

    async getExecutedMigrations() {
        return Array.from(this.executedMigrations);
    }

    async acquireLock() {
        try {
            if (fs.existsSync(this.lockFile)) {
                const lockData = JSON.parse(fs.readFileSync(this.lockFile, 'utf8'));
                const lockTime = new Date(lockData.timestamp);
                const now = new Date();

                // Check if lock is older than 5 minutes (stale lock)
                if (now - lockTime > 5 * 60 * 1000) {
                    console.log('Removing stale migration lock');
                    fs.unlinkSync(this.lockFile);
                } else {
                    return false;
                }
            }

            fs.writeFileSync(this.lockFile, JSON.stringify({
                timestamp: new Date(),
                pid: process.pid
            }));

            return true;
        } catch (error) {
            console.error('Error acquiring migration lock:', error);
            return false;
        }
    }

    async releaseLock() {
        try {
            if (fs.existsSync(this.lockFile)) {
                fs.unlinkSync(this.lockFile);
            }
        } catch (error) {
            console.error('Error releasing migration lock:', error);
        }
    }

    async createBackup() {
        console.log('Creating database backup before migration...');
        // Placeholder - no actual backup implementation
        console.log('Backup created (simulated)');
    }

    async saveMigrationHistory() {
        const historyFile = path.join(this.migrationsPath, 'history.json');
        const history = {
            executed: Array.from(this.executedMigrations),
            records: this.migrationHistory,
            lastUpdated: new Date()
        };

        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    }

    getMigrationStatus() {
        const pending = this.getPendingMigrations();
        const executed = Array.from(this.executedMigrations);

        return {
            pendingMigrations: pending.length,
            executedMigrations: executed.length,
            totalMigrations: pending.length + executed.length,
            lastMigration: this.migrationHistory.length > 0 ?
                this.migrationHistory[this.migrationHistory.length - 1] : null
        };
    }

    async validateMigrations() {
        const migrations = await this.getPendingMigrations();
        const errors = [];

        for (const migration of migrations) {
            try {
                // Check if migration has required methods
                if (!migration.up) {
                    errors.push(`${migration.fileName}: Missing 'up' method`);
                }
                if (!migration.down) {
                    errors.push(`${migration.fileName}: Missing 'down' method`);
                }
                if (!migration.name) {
                    errors.push(`${migration.fileName}: Missing 'name' property`);
                }
            } catch (error) {
                errors.push(`${migration.fileName}: Invalid migration format`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    async dryRunMigrations() {
        const migrations = await this.getPendingMigrations();
        const results = [];

        for (const migration of migrations) {
            try {
                console.log(`Dry run: Would execute migration ${migration.name}`);
                results.push({
                    name: migration.name,
                    fileName: migration.fileName,
                    status: 'would_execute'
                });
            } catch (error) {
                results.push({
                    name: migration.name,
                    fileName: migration.fileName,
                    status: 'error',
                    error: error.message
                });
            }
        }

        return results;
    }

    getMigrationHistory(limit = 50) {
        return this.migrationHistory
            .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))
            .slice(0, limit);
    }

    exportMigrationHistory(format = 'json') {
        const history = this.getMigrationHistory();

        if (format === 'csv') {
            let csv = 'Name,FileName,Status,ExecutedAt,Error\n';
            for (const record of history) {
                csv += `"${record.name}","${record.fileName}","${record.status}","${record.executedAt}","${record.error || ''}"\n`;
            }
            return csv;
        }

        return JSON.stringify(history, null, 2);
    }

    async resetMigrations() {
        console.warn('Resetting all migrations - this will clear migration history');

        this.executedMigrations.clear();
        this.migrationHistory = [];

        const historyFile = path.join(this.migrationsPath, 'history.json');
        if (fs.existsSync(historyFile)) {
            fs.unlinkSync(historyFile);
        }

        await this.saveMigrationHistory();
        console.log('Migration history reset');
    }

    setConnection(connection) {
        this.connection = connection;
    }

    getConnection() {
        return this.connection;
    }
}

module.exports = DatabaseMigrations;
