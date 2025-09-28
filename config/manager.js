const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor(configPath = './config/app.json') {
        this.configPath = configPath;
        this.config = {};
        this.defaults = {
            port: 3000,
            database: {
                host: 'localhost',
                port: 5432,
                name: 'app'
            },
            redis: {
                host: 'localhost',
                port: 6379
            },
            api: {
                timeout: 5000,
                retries: 3
            }
        };
        this.watchers = new Map();
        this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                const loaded = JSON.parse(data);
                this.config = { ...this.defaults, ...loaded };
            } else {
                this.config = { ...this.defaults };
                this.saveConfig();
            }
        } catch (error) {
            console.warn('Error loading config, using defaults:', error.message);
            this.config = { ...this.defaults };
        }
    }

    saveConfig() {
        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving config:', error);
        }
    }

    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.config;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }

        return value;
    }

    set(key, value) {
        const keys = key.split('.');
        let obj = this.config;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!obj[k] || typeof obj[k] !== 'object') {
                obj[k] = {};
            }
            obj = obj[k];
        }

        obj[keys[keys.length - 1]] = value;
        this.saveConfig();
    }

    update(updates) {
        this.deepMerge(this.config, updates);
        this.saveConfig();
    }

    deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }

    reset() {
        this.config = { ...this.defaults };
        this.saveConfig();
    }

    watch(callback) {
        if (this.watchers.has(this.configPath)) {
            return;
        }

        try {
            const watcher = fs.watch(this.configPath, (eventType) => {
                if (eventType === 'change') {
                    this.loadConfig();
                    if (callback) callback(this.config);
                }
            });

            this.watchers.set(this.configPath, watcher);
        } catch (error) {
            console.error('Error setting up config watcher:', error);
        }
    }

    unwatch() {
        const watcher = this.watchers.get(this.configPath);
        if (watcher) {
            watcher.close();
            this.watchers.delete(this.configPath);
        }
    }

    validate() {
        const errors = [];

        if (!this.config.port || this.config.port < 1 || this.config.port > 65535) {
            errors.push('Invalid port number');
        }

        if (this.config.database) {
            if (!this.config.database.host) {
                errors.push('Database host is required');
            }
            if (!this.config.database.port || this.config.database.port < 1) {
                errors.push('Invalid database port');
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    getAll() {
        return { ...this.config };
    }

    has(key) {
        const keys = key.split('.');
        let value = this.config;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return false;
            }
        }

        return true;
    }

    delete(key) {
        const keys = key.split('.');
        let obj = this.config;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (obj[k] && typeof obj[k] === 'object') {
                obj = obj[k];
            } else {
                return false;
            }
        }

        if (keys[keys.length - 1] in obj) {
            delete obj[keys[keys.length - 1]];
            this.saveConfig();
            return true;
        }

        return false;
    }

    export() {
        return JSON.stringify(this.config, null, 2);
    }

    import(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            this.config = { ...this.defaults, ...imported };
            this.saveConfig();
            return true;
        } catch (error) {
            console.error('Error importing config:', error);
            return false;
        }
    }

    createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `./config/backup-${timestamp}.json`;

        try {
            fs.writeFileSync(backupPath, this.export());
            return backupPath;
        } catch (error) {
            console.error('Error creating backup:', error);
            return null;
        }
    }

    restoreFromBackup(backupPath) {
        try {
            if (!fs.existsSync(backupPath)) {
                return false;
            }

            const data = fs.readFileSync(backupPath, 'utf8');
            return this.import(data);
        } catch (error) {
            console.error('Error restoring backup:', error);
            return false;
        }
    }

    getEnvironmentOverrides() {
        const overrides = {};

        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith('APP_')) {
                const configKey = key.substring(4).toLowerCase().replace(/_/g, '.');
                overrides[configKey] = value;
            }
        }

        return overrides;
    }

    applyEnvironmentOverrides() {
        const overrides = this.getEnvironmentOverrides();
        this.update(overrides);
    }

    getSchema() {
        return {
            port: { type: 'number', required: true, min: 1, max: 65535 },
            database: {
                host: { type: 'string', required: true },
                port: { type: 'number', required: true, min: 1, max: 65535 },
                name: { type: 'string', required: true }
            },
            redis: {
                host: { type: 'string', required: false },
                port: { type: 'number', required: false, min: 1, max: 65535 }
            }
        };
    }
}

module.exports = ConfigManager;
