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

    // Advanced configuration features
    enableEncryption(secretKey) {
        this.encryptionEnabled = true;
        this.encryptionKey = secretKey;
    }

    encryptConfig() {
        if (!this.encryptionEnabled) return;

        const crypto = require('crypto');
        const cipher = crypto.createCipher('aes256', this.encryptionKey);
        const encrypted = cipher.update(JSON.stringify(this.config), 'utf8', 'hex') + cipher.final('hex');

        this.encryptedConfig = encrypted;
        return encrypted;
    }

    decryptConfig(encryptedData) {
        if (!this.encryptionEnabled) return;

        const crypto = require('crypto');
        const decipher = crypto.createDecipher('aes256', this.encryptionKey);
        const decrypted = decipher.update(encryptedData, 'hex', 'utf8') + decipher.final('utf8');

        this.config = JSON.parse(decrypted);
        return this.config;
    }

    createBackup() {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const backupPath = `./config/backups/backup_${timestamp}.json`;

        try {
            const fs = require('fs');
            const path = require('path');

            // Ensure backup directory exists
            const backupDir = path.dirname(backupPath);
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            fs.writeFileSync(backupPath, JSON.stringify({
                config: this.config,
                timestamp: new Date(),
                version: '1.0'
            }, null, 2));

            return backupPath;
        } catch (error) {
            console.error('Error creating backup:', error);
            return null;
        }
    }

    restoreFromBackup(backupPath) {
        try {
            const fs = require('fs');
            const backup = JSON.parse(fs.readFileSync(backupPath));

            this.config = { ...this.defaults, ...backup.config };
            this.saveConfig();

            return true;
        } catch (error) {
            console.error('Error restoring from backup:', error);
            return false;
        }
    }

    validateSchema() {
        const schema = {
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

        return this.validateAgainstSchema(this.config, schema);
    }

    validateAgainstSchema(data, schema) {
        const errors = [];

        for (const [key, rules] of Object.entries(schema)) {
            const value = data[key];

            if (rules.required && (value === undefined || value === null)) {
                errors.push(`Missing required field: ${key}`);
                continue;
            }

            if (value !== undefined && value !== null) {
                if (rules.type && typeof value !== rules.type) {
                    errors.push(`Invalid type for ${key}: expected ${rules.type}, got ${typeof value}`);
                }

                if (rules.min !== undefined && value < rules.min) {
                    errors.push(`Value too small for ${key}: minimum ${rules.min}`);
                }

                if (rules.max !== undefined && value > rules.max) {
                    errors.push(`Value too large for ${key}: maximum ${rules.max}`);
                }

                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`Value does not match pattern for ${key}`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    migrate(oldVersion, newVersion) {
        // Simple migration system
        const migrations = {
            '1.0': (config) => {
                // Add new default fields
                config.api = config.api || { timeout: 5000, retries: 3 };
                return config;
            },
            '1.1': (config) => {
                // Add logging configuration
                config.logging = config.logging || { level: 'INFO', file: './logs/app.log' };
                return config;
            }
        };

        let currentConfig = { ...this.config };

        // Apply migrations in order
        const versions = Object.keys(migrations).sort();
        for (const version of versions) {
            if (this.compareVersions(oldVersion, version) < 0) {
                currentConfig = migrations[version](currentConfig);
            }
        }

        this.config = currentConfig;
        this.saveConfig();

        return this.config;
    }

    compareVersions(version1, version2) {
        const v1 = version1.split('.').map(Number);
        const v2 = version2.split('.').map(Number);

        for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
            const num1 = v1[i] || 0;
            const num2 = v2[i] || 0;

            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }

        return 0;
    }

    createProfile(name) {
        const profile = {
            name,
            config: { ...this.config },
            created: new Date()
        };

        this.profiles = this.profiles || new Map();
        this.profiles.set(name, profile);

        return profile;
    }

    switchProfile(name) {
        const profile = this.profiles?.get(name);
        if (!profile) {
            throw new Error(`Profile ${name} not found`);
        }

        this.config = { ...profile.config };
        this.saveConfig();

        return this.config;
    }

    listProfiles() {
        return Array.from(this.profiles?.values() || []);
    }

    deleteProfile(name) {
        return this.profiles?.delete(name) || false;
    }

    enableHotReload() {
        this.hotReloadEnabled = true;

        // Watch for config file changes
        const fs = require('fs');
        if (fs.existsSync(this.configPath)) {
            fs.watch(this.configPath, (eventType) => {
                if (eventType === 'change') {
                    console.log('Config file changed, reloading...');
                    this.loadConfig();
                }
            });
        }
    }

    disableHotReload() {
        this.hotReloadEnabled = false;
    }

    createConfigTemplate(name, template) {
        this.templates = this.templates || new Map();
        this.templates.set(name, template);
    }

    generateFromTemplate(templateName, overrides = {}) {
        const template = this.templates?.get(templateName);
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }

        this.config = { ...template, ...overrides };
        this.saveConfig();

        return this.config;
    }

    listTemplates() {
        return Array.from(this.templates?.keys() || []);
    }

    validateConfiguration() {
        const validation = this.validateSchema();

        if (!validation.valid) {
            console.error('Configuration validation failed:', validation.errors);
            return false;
        }

        // Additional custom validations
        const customErrors = [];

        if (this.config.database?.host === 'localhost' && this.config.database?.port === 3306) {
            customErrors.push('Using default database configuration - consider changing for production');
        }

        if (this.config.redis?.host === 'localhost' && !this.config.redis?.password) {
            customErrors.push('Redis is not secured - consider adding authentication');
        }

        return {
            valid: customErrors.length === 0,
            errors: customErrors,
            warnings: customErrors
        };
    }

    getConfigSummary() {
        return {
            totalKeys: Object.keys(this.config).length,
            nestedObjects: Object.values(this.config).filter(v => typeof v === 'object' && v !== null).length,
            stringValues: Object.values(this.config).filter(v => typeof v === 'string').length,
            numberValues: Object.values(this.config).filter(v => typeof v === 'number').length,
            booleanValues: Object.values(this.config).filter(v => typeof v === 'boolean').length,
            hasEncryption: this.encryptionEnabled,
            hasHotReload: this.hotReloadEnabled,
            profilesCount: this.profiles?.size || 0,
            templatesCount: this.templates?.size || 0
        };
    }

    createConfigDiff(oldConfig, newConfig) {
        const diff = {
            added: {},
            removed: {},
            changed: {}
        };

        // Find added keys
        for (const key of Object.keys(newConfig)) {
            if (!(key in oldConfig)) {
                diff.added[key] = newConfig[key];
            }
        }

        // Find removed keys
        for (const key of Object.keys(oldConfig)) {
            if (!(key in newConfig)) {
                diff.removed[key] = oldConfig[key];
            }
        }

        // Find changed keys
        for (const key of Object.keys(newConfig)) {
            if (key in oldConfig && JSON.stringify(oldConfig[key]) !== JSON.stringify(newConfig[key])) {
                diff.changed[key] = {
                    from: oldConfig[key],
                    to: newConfig[key]
                };
            }
        }

        return diff;
    }

    applyConfigPatch(patch) {
        const patchedConfig = { ...this.config };

        // Apply additions
        Object.assign(patchedConfig, patch.added || {});

        // Apply changes
        for (const [key, change] of Object.entries(patch.changed || {})) {
            patchedConfig[key] = change.to;
        }

        // Remove deletions
        for (const key of Object.keys(patch.removed || {})) {
            delete patchedConfig[key];
        }

        this.config = patchedConfig;
        this.saveConfig();

        return this.config;
    }

    createConfigSnapshot() {
        return {
            config: { ...this.config },
            timestamp: new Date(),
            checksum: this.calculateConfigChecksum()
        };
    }

    calculateConfigChecksum() {
        const crypto = require('crypto');
        const configStr = JSON.stringify(this.config, Object.keys(this.config).sort());
        return crypto.createHash('md5').update(configStr).digest('hex');
    }

    compareSnapshots(snapshot1, snapshot2) {
        return {
            checksumsMatch: snapshot1.checksum === snapshot2.checksum,
            diff: this.createConfigDiff(snapshot1.config, snapshot2.config)
        };
    }

    enableConfigAuditing() {
        this.auditingEnabled = true;
        this.auditLog = [];
    }

    auditConfigChange(action, details) {
        if (!this.auditingEnabled) return;

        this.auditLog.push({
            timestamp: new Date(),
            action,
            details,
            configSnapshot: this.createConfigSnapshot()
        });
    }

    getConfigAuditLog() {
        return this.auditLog || [];
    }

    createConfigVersion(version, changes) {
        this.versions = this.versions || new Map();
        this.versions.set(version, {
            version,
            config: { ...this.config },
            changes,
            created: new Date()
        });
    }

    getConfigVersion(version) {
        return this.versions?.get(version);
    }

    rollbackToVersion(version) {
        const versionData = this.versions?.get(version);
        if (!versionData) {
            throw new Error(`Version ${version} not found`);
        }

        this.config = { ...versionData.config };
        this.saveConfig();

        this.auditConfigChange('rollback', { fromVersion: version });
    }

    listConfigVersions() {
        return Array.from(this.versions?.values() || []);
    }

    createConfigEnvironment(env) {
        this.environments = this.environments || new Map();
        this.environments.set(env, {
            name: env,
            config: { ...this.config },
            variables: {}
        });
    }

    switchEnvironment(env) {
        const environment = this.environments?.get(env);
        if (!environment) {
            throw new Error(`Environment ${env} not found`);
        }

        this.config = { ...environment.config };
        this.saveConfig();
    }

    setEnvironmentVariable(env, key, value) {
        const environment = this.environments?.get(env);
        if (environment) {
            environment.variables[key] = value;
        }
    }

    getEnvironmentVariables(env) {
        return this.environments?.get(env)?.variables || {};
    }

    createConfigOverride(overrideName, overrides) {
        this.overrides = this.overrides || new Map();
        this.overrides.set(overrideName, {
            name: overrideName,
            overrides,
            created: new Date()
        });
    }

    applyOverride(overrideName) {
        const override = this.overrides?.get(overrideName);
        if (!override) {
            throw new Error(`Override ${overrideName} not found`);
        }

        this.config = this.deepMerge(this.config, override.overrides);
        this.saveConfig();
    }

    removeOverride(overrideName) {
        const override = this.overrides?.get(overrideName);
        if (!override) return false;

        // Revert the override (simplified)
        this.loadConfig(); // Reload original config
        return true;
    }

    listOverrides() {
        return Array.from(this.overrides?.values() || []);
    }

    createConfigPreset(presetName, presetConfig) {
        this.presets = this.presets || new Map();
        this.presets.set(presetName, {
            name: presetName,
            config: presetConfig,
            created: new Date()
        });
    }

    applyPreset(presetName) {
        const preset = this.presets?.get(presetName);
        if (!preset) {
            throw new Error(`Preset ${presetName} not found`);
        }

        this.config = { ...this.defaults, ...preset.config };
        this.saveConfig();
    }

    listPresets() {
        return Array.from(this.presets?.values() || []);
    }

    createConfigValidator(rules) {
        return {
            rules,

            validate: (config) => {
                const errors = [];

                for (const [key, rule] of Object.entries(this.rules)) {
                    const value = config[key];

                    if (rule.required && (value === undefined || value === null || value === '')) {
                        errors.push(`${key} is required`);
                    }

                    if (value !== undefined && value !== null) {
                        if (rule.type && typeof value !== rule.type) {
                            errors.push(`${key} must be of type ${rule.type}`);
                        }

                        if (rule.min !== undefined && value < rule.min) {
                            errors.push(`${key} must be at least ${rule.min}`);
                        }

                        if (rule.max !== undefined && value > rule.max) {
                            errors.push(`${key} must be at most ${rule.max}`);
                        }

                        if (rule.pattern && !rule.pattern.test(value)) {
                            errors.push(`${key} does not match required pattern`);
                        }

                        if (rule.custom && !rule.custom(value)) {
                            errors.push(`${key} failed custom validation`);
                        }
                    }
                }

                return {
                    valid: errors.length === 0,
                    errors
                };
            }
        };
    }

    enableConfigCaching() {
        this.cachingEnabled = true;
        this.configCache = new Map();
        this.cacheTimeout = 300000; // 5 minutes
    }

    getCachedConfig(key) {
        if (!this.cachingEnabled) return null;

        const cached = this.configCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.value;
        }

        this.configCache.delete(key);
        return null;
    }

    setCachedConfig(key, value) {
        if (this.cachingEnabled) {
            this.configCache.set(key, {
                value,
                timestamp: Date.now()
            });
        }
    }

    clearConfigCache() {
        if (this.configCache) {
            this.configCache.clear();
        }
    }

    createConfigWatcher(callback) {
        const fs = require('fs');

        if (!fs.existsSync(this.configPath)) {
            return null;
        }

        const watcher = fs.watch(this.configPath, (eventType) => {
            if (eventType === 'change') {
                const oldConfig = { ...this.config };
                this.loadConfig();
                callback(oldConfig, this.config);
            }
        });

        return watcher;
    }

    createConfigMerger() {
        return {
            mergeStrategies: {
                override: (target, source) => ({ ...target, ...source }),
                deepMerge: (target, source) => this.deepMerge(target, source),
                arrayConcat: (target, source) => {
                    const result = { ...target };
                    for (const [key, value] of Object.entries(source)) {
                        if (Array.isArray(value) && Array.isArray(result[key])) {
                            result[key] = [...result[key], ...value];
                        } else {
                            result[key] = value;
                        }
                    }
                    return result;
                }
            },

            merge: (configs, strategy = 'override') => {
                const mergeFn = this.mergeStrategies[strategy];
                if (!mergeFn) {
                    throw new Error(`Unknown merge strategy: ${strategy}`);
                }

                return configs.reduce((merged, config) => mergeFn(merged, config));
            }
        };
    }

    createConfigEncryptor() {
        const crypto = require('crypto');

        return {
            algorithm: 'aes-256-cbc',
            keyLength: 32,
            ivLength: 16,

            generateKey: (password, salt) => {
                return crypto.scryptSync(password, salt, this.keyLength);
            },

            generateIV: () => {
                return crypto.randomBytes(this.ivLength);
            },

            encrypt: (data, key, iv) => {
                const cipher = crypto.createCipheriv(this.algorithm, key, iv);
                let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
                encrypted += cipher.final('hex');
                return {
                    encrypted,
                    iv: iv.toString('hex')
                };
            },

            decrypt: (encryptedData, key, iv) => {
                const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
                let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                return JSON.parse(decrypted);
            }
        };
    }

    createConfigSerializer() {
        return {
            formats: {
                json: {
                    serialize: (config) => JSON.stringify(config, null, 2),
                    deserialize: (data) => JSON.parse(data)
                },

                yaml: {
                    serialize: (config) => {
                        // Mock YAML serialization
                        let yaml = '';
                        for (const [key, value] of Object.entries(config)) {
                            yaml += `${key}: ${JSON.stringify(value)}\n`;
                        }
                        return yaml;
                    },
                    deserialize: (data) => {
                        // Mock YAML deserialization
                        const lines = data.split('\n');
                        const config = {};

                        for (const line of lines) {
                            if (line.includes(':')) {
                                const [key, ...valueParts] = line.split(':');
                                const value = valueParts.join(':').trim();
                                try {
                                    config[key.trim()] = JSON.parse(value);
                                } catch {
                                    config[key.trim()] = value;
                                }
                            }
                        }

                        return config;
                    }
                },

                xml: {
                    serialize: (config) => {
                        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n';
                        for (const [key, value] of Object.entries(config)) {
                            xml += `  <${key}>${JSON.stringify(value)}</${key}>\n`;
                        }
                        xml += '</config>';
                        return xml;
                    },
                    deserialize: (data) => {
                        // Simple XML parsing (mock)
                        const config = {};
                        const regex = /<(\w+)>(.*?)<\/\1>/g;
                        let match;

                        while ((match = regex.exec(data)) !== null) {
                            const [, key, value] = match;
                            try {
                                config[key] = JSON.parse(value);
                            } catch {
                                config[key] = value;
                            }
                        }

                        return config;
                    }
                }
            },

            serialize: (config, format = 'json') => {
                const formatter = this.formats[format];
                if (!formatter) {
                    throw new Error(`Unsupported format: ${format}`);
                }
                return formatter.serialize(config);
            },

            deserialize: (data, format = 'json') => {
                const formatter = this.formats[format];
                if (!formatter) {
                    throw new Error(`Unsupported format: ${format}`);
                }
                return formatter.deserialize(data);
            }
        };
    }

    createConfigComparator() {
        return {
            compare: (config1, config2) => {
                return {
                    equal: JSON.stringify(config1) === JSON.stringify(config2),
                    differences: this.findDifferences(config1, config2)
                };
            },

            findDifferences: (obj1, obj2, path = '') => {
                const differences = [];

                const keys1 = Object.keys(obj1 || {});
                const keys2 = Object.keys(obj2 || {});

                const allKeys = new Set([...keys1, ...keys2]);

                for (const key of allKeys) {
                    const fullPath = path ? `${path}.${key}` : key;
                    const val1 = obj1?.[key];
                    const val2 = obj2?.[key];

                    if (!(key in obj1)) {
                        differences.push({
                            type: 'added',
                            path: fullPath,
                            value: val2
                        });
                    } else if (!(key in obj2)) {
                        differences.push({
                            type: 'removed',
                            path: fullPath,
                            value: val1
                        });
                    } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
                        if (typeof val1 === 'object' && typeof val2 === 'object') {
                            differences.push(...this.findDifferences(val1, val2, fullPath));
                        } else {
                            differences.push({
                                type: 'changed',
                                path: fullPath,
                                from: val1,
                                to: val2
                            });
                        }
                    }
                }

                return differences;
            }
        };
    }

    createConfigOptimizer() {
        return {
            optimize: (config) => {
                const optimized = { ...config };

                // Remove null/undefined values
                for (const [key, value] of Object.entries(optimized)) {
                    if (value === null || value === undefined) {
                        delete optimized[key];
                    } else if (typeof value === 'object' && !Array.isArray(value)) {
                        optimized[key] = this.optimize(value);
                    }
                }

                // Sort keys for consistency
                const sorted = {};
                Object.keys(optimized).sort().forEach(key => {
                    sorted[key] = optimized[key];
                });

                return sorted;
            },

            compress: (config) => {
                // Remove redundant default values
                const compressed = { ...config };

                for (const [key, value] of Object.entries(compressed)) {
                    if (JSON.stringify(value) === JSON.stringify(this.defaults[key])) {
                        delete compressed[key];
                    }
                }

                return compressed;
            },

            analyze: (config) => {
                const analysis = {
                    totalKeys: 0,
                    maxDepth: 0,
                    stringValues: 0,
                    numberValues: 0,
                    booleanValues: 0,
                    objectValues: 0,
                    arrayValues: 0
                };

                const analyzeRecursive = (obj, depth = 0) => {
                    analysis.maxDepth = Math.max(analysis.maxDepth, depth);

                    for (const [key, value] of Object.entries(obj)) {
                        analysis.totalKeys++;

                        if (typeof value === 'string') analysis.stringValues++;
                        else if (typeof value === 'number') analysis.numberValues++;
                        else if (typeof value === 'boolean') analysis.booleanValues++;
                        else if (Array.isArray(value)) analysis.arrayValues++;
                        else if (typeof value === 'object') {
                            analysis.objectValues++;
                            analyzeRecursive(value, depth + 1);
                        }
                    }
                };

                analyzeRecursive(config);
                return analysis;
            }
        };
    }

    createConfigCloner() {
        return {
            shallowClone: (config) => ({ ...config }),

            deepClone: (config) => JSON.parse(JSON.stringify(config)),

            selectiveClone: (config, keys) => {
                const cloned = {};

                for (const key of keys) {
                    if (key in config) {
                        cloned[key] = typeof config[key] === 'object' ?
                            JSON.parse(JSON.stringify(config[key])) : config[key];
                    }
                }

                return cloned;
            }
        };
    }

    createConfigTransformer() {
        return {
            transformers: new Map(),

            registerTransformer: (name, transformer) => {
                this.transformers.set(name, transformer);
            },

            transform: (config, transformerName) => {
                const transformer = this.transformers.get(transformerName);
                if (!transformer) {
                    throw new Error(`Transformer ${transformerName} not found`);
                }

                return transformer(config);
            },

            createEnvironmentTransformer: (env) => {
                return (config) => {
                    const transformed = { ...config };

                    // Environment-specific transformations
                    if (env === 'production') {
                        transformed.debug = false;
                        transformed.logging = transformed.logging || {};
                        transformed.logging.level = 'WARN';
                    } else if (env === 'development') {
                        transformed.debug = true;
                        transformed.logging = transformed.logging || {};
                        transformed.logging.level = 'DEBUG';
                    }

                    return transformed;
                };
            },

            createSecurityTransformer: () => {
                return (config) => {
                    const transformed = { ...config };

                    // Remove sensitive information
                    const sensitiveKeys = ['password', 'secret', 'token', 'key'];
                    const removeSensitive = (obj) => {
                        for (const [key, value] of Object.entries(obj)) {
                            if (sensitiveKeys.includes(key.toLowerCase())) {
                                obj[key] = '[REDACTED]';
                            } else if (typeof value === 'object' && value !== null) {
                                removeSensitive(value);
                            }
                        }
                    };

                    removeSensitive(transformed);
                    return transformed;
                };
            }
        };
    }

    createConfigValidator() {
        return {
            rules: new Map(),

            addRule: (field, rule) => {
                this.rules.set(field, rule);
            },

            validate: (config) => {
                const errors = [];
                const warnings = [];

                for (const [field, rule] of this.rules.entries()) {
                    const value = this.getNestedValue(config, field);

                    if (rule.required && (value === undefined || value === null)) {
                        errors.push(`Field ${field} is required`);
                        continue;
                    }

                    if (value !== undefined && value !== null) {
                        if (rule.type && typeof value !== rule.type) {
                            errors.push(`Field ${field} must be of type ${rule.type}`);
                        }

                        if (rule.min !== undefined && value < rule.min) {
                            errors.push(`Field ${field} must be at least ${rule.min}`);
                        }

                        if (rule.max !== undefined && value > rule.max) {
                            errors.push(`Field ${field} must be at most ${rule.max}`);
                        }

                        if (rule.pattern && !rule.pattern.test(value)) {
                            errors.push(`Field ${field} does not match required pattern`);
                        }

                        if (rule.enum && !rule.enum.includes(value)) {
                            errors.push(`Field ${field} must be one of: ${rule.enum.join(', ')}`);
                        }

                        if (rule.custom && !rule.custom(value)) {
                            errors.push(`Field ${field} failed custom validation`);
                        }
                    }
                }

                return {
                    valid: errors.length === 0,
                    errors,
                    warnings
                };
            },

            getNestedValue: (obj, path) => {
                return path.split('.').reduce((current, key) => current?.[key], obj);
            }
        };
    }

    createConfigHistory() {
        return {
            history: [],
            maxEntries: 100,

            record: (config, action = 'update') => {
                this.history.push({
                    timestamp: new Date(),
                    action,
                    config: JSON.parse(JSON.stringify(config)),
                    checksum: this.calculateChecksum(config)
                });

                // Limit history size
                if (this.history.length > this.maxEntries) {
                    this.history.shift();
                }
            },

            getHistory: (limit = 10) => {
                return this.history.slice(-limit);
            },

            revertTo: (index) => {
                if (index < 0 || index >= this.history.length) {
                    throw new Error('Invalid history index');
                }

                const historicalConfig = this.history[index];
                this.config = JSON.parse(JSON.stringify(historicalConfig.config));
                this.saveConfig();

                return this.config;
            },

            calculateChecksum: (config) => {
                const crypto = require('crypto');
                return crypto.createHash('md5').update(JSON.stringify(config)).digest('hex');
            },

            findChanges: (fromIndex, toIndex) => {
                if (fromIndex >= this.history.length || toIndex >= this.history.length) {
                    throw new Error('Invalid indices');
                }

                const fromConfig = this.history[fromIndex].config;
                const toConfig = this.history[toIndex].config;

                return this.createConfigDiff(fromConfig, toConfig);
            }
        };
    }

    createConfigDebugger() {
        return {
            debug: (config) => {
                console.log('=== Config Debug Info ===');
                console.log('Total keys:', Object.keys(config).length);
                console.log('Structure:');

                const printStructure = (obj, indent = 0) => {
                    const spaces = '  '.repeat(indent);
                    for (const [key, value] of Object.entries(obj)) {
                        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                            console.log(`${spaces}${key}:`);
                            printStructure(value, indent + 1);
                        } else {
                            console.log(`${spaces}${key}: ${typeof value} = ${JSON.stringify(value)}`);
                        }
                    }
                };

                printStructure(config);
                console.log('=== End Debug Info ===');
            },

            findIssues: (config) => {
                const issues = [];

                const checkRecursive = (obj, path = '') => {
                    for (const [key, value] of Object.entries(obj)) {
                        const currentPath = path ? `${path}.${key}` : key;

                        if (value === null || value === undefined) {
                            issues.push(`Null/undefined value at ${currentPath}`);
                        }

                        if (typeof value === 'string' && value.includes('password') && !value.includes('[REDACTED]')) {
                            issues.push(`Potential sensitive data at ${currentPath}`);
                        }

                        if (typeof value === 'object' && value !== null) {
                            checkRecursive(value, currentPath);
                        }
                    }
                };

                checkRecursive(config);
                return issues;
            },

            performanceTest: () => {
                const startTime = Date.now();

                // Simulate config operations
                for (let i = 0; i < 1000; i++) {
                    this.get('database.host');
                    this.set('test.key', `value${i}`);
                }

                const endTime = Date.now();
                return {
                    operations: 2000,
                    time: endTime - startTime,
                    opsPerSecond: 2000 / ((endTime - startTime) / 1000)
                };
            }
        };
    }

    createConfigMonitor() {
        return {
            monitors: new Map(),

            addMonitor: (name, condition, callback) => {
                this.monitors.set(name, { condition, callback, active: true });
            },

            checkMonitors: (config) => {
                for (const [name, monitor] of this.monitors.entries()) {
                    if (monitor.active && monitor.condition(config)) {
                        monitor.callback(config, name);
                    }
                }
            },

            enableMonitor: (name) => {
                const monitor = this.monitors.get(name);
                if (monitor) monitor.active = true;
            },

            disableMonitor: (name) => {
                const monitor = this.monitors.get(name);
                if (monitor) monitor.active = false;
            },

            createThresholdMonitor: (field, threshold, callback) => {
                const condition = (config) => {
                    const value = this.getNestedValue(config, field);
                    return value > threshold;
                };

                this.addMonitor(`threshold_${field}`, condition, callback);
            },

            getNestedValue: (obj, path) => {
                return path.split('.').reduce((current, key) => current?.[key], obj);
            }
        };
    }

    createConfigImporter() {
        return {
            formats: {
                json: (data) => JSON.parse(data),
                yaml: (data) => {
                    // Mock YAML parsing
                    const lines = data.split('\n');
                    const config = {};

                    for (const line of lines) {
                        if (line.includes(':')) {
                            const [key, value] = line.split(':').map(s => s.trim());
                            try {
                                config[key] = JSON.parse(value);
                            } catch {
                                config[key] = value;
                            }
                        }
                    }

                    return config;
                },
                env: (data) => {
                    const lines = data.split('\n');
                    const config = {};

                    for (const line of lines) {
                        if (line.includes('=')) {
                            const [key, value] = line.split('=');
                            config[key.trim()] = value.trim();
                        }
                    }

                    return config;
                }
            },

            import: (data, format = 'json') => {
                const parser = this.formats[format];
                if (!parser) {
                    throw new Error(`Unsupported import format: ${format}`);
                }

                return parser(data);
            },

            importFromFile: (filePath, format) => {
                const fs = require('fs');
                const data = fs.readFileSync(filePath, 'utf8');
                return this.import(data, format);
            }
        };
    }

    createConfigExporter() {
        return {
            formats: {
                json: (config) => JSON.stringify(config, null, 2),
                yaml: (config) => {
                    let yaml = '';
                    const writeValue = (obj, indent = 0) => {
                        const spaces = '  '.repeat(indent);
                        for (const [key, value] of Object.entries(obj)) {
                            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                                yaml += `${spaces}${key}:\n`;
                                writeValue(value, indent + 1);
                            } else {
                                yaml += `${spaces}${key}: ${JSON.stringify(value)}\n`;
                            }
                        }
                    };
                    writeValue(config);
                    return yaml;
                },
                env: (config) => {
                    let env = '';
                    const writeFlat = (obj, prefix = '') => {
                        for (const [key, value] of Object.entries(obj)) {
                            const fullKey = prefix ? `${prefix}_${key}` : key;
                            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                                writeFlat(value, fullKey);
                            } else {
                                env += `${fullKey}=${value}\n`;
                            }
                        }
                    };
                    writeFlat(config);
                    return env;
                }
            },

            export: (config, format = 'json') => {
                const formatter = this.formats[format];
                if (!formatter) {
                    throw new Error(`Unsupported export format: ${format}`);
                }

                return formatter(config);
            },

            exportToFile: (config, filePath, format) => {
                const fs = require('fs');
                const data = this.export(config, format);
                fs.writeFileSync(filePath, data);
            }
        };
    }

    createConfigSynchronizer() {
        return {
            syncSources: new Map(),

            addSyncSource: (name, source) => {
                this.syncSources.set(name, source);
            },

            sync: async (sourceName) => {
                const source = this.syncSources.get(sourceName);
                if (!source) {
                    throw new Error(`Sync source ${sourceName} not found`);
                }

                const remoteConfig = await source.fetch();
                this.config = this.deepMerge(this.config, remoteConfig);
                this.saveConfig();

                return this.config;
            },

            createRemoteSource: (url, apiKey) => {
                return {
                    fetch: async () => {
                        const response = await fetch(url, {
                            headers: { 'Authorization': `Bearer ${apiKey}` }
                        });
                        return response.json();
                    }
                };
            },

            createFileSource: (filePath) => {
                return {
                    fetch: async () => {
                        const fs = require('fs');
                        const data = fs.readFileSync(filePath, 'utf8');
                        return JSON.parse(data);
                    }
                };
            }
        };
    }

    createConfigPartitioner() {
        return {
            partitions: new Map(),

            createPartition: (name, criteria) => {
                this.partitions.set(name, {
                    name,
                    criteria,
                    config: {}
                });
            },

            assignToPartition: (key, partitionName) => {
                const partition = this.partitions.get(partitionName);
                if (partition && this.config[key] !== undefined) {
                    partition.config[key] = this.config[key];
                }
            },

            getPartition: (name) => {
                return this.partitions.get(name)?.config || {};
            },

            mergePartitions: (partitionNames) => {
                let merged = {};

                for (const name of partitionNames) {
                    const partition = this.partitions.get(name);
                    if (partition) {
                        merged = { ...merged, ...partition.config };
                    }
                }

                return merged;
            }
        };
    }

    createConfigProfiler() {
        return {
            profiles: new Map(),

            startProfile: (name) => {
                this.profiles.set(name, {
                    name,
                    startTime: Date.now(),
                    operations: [],
                    memoryUsage: []
                });
            },

            recordOperation: (profileName, operation, duration) => {
                const profile = this.profiles.get(profileName);
                if (profile) {
                    profile.operations.push({
                        operation,
                        duration,
                        timestamp: Date.now()
                    });
                }
            },

            recordMemoryUsage: (profileName) => {
                const profile = this.profiles.get(profileName);
                if (profile) {
                    profile.memoryUsage.push({
                        usage: process.memoryUsage(),
                        timestamp: Date.now()
                    });
                }
            },

            endProfile: (name) => {
                const profile = this.profiles.get(name);
                if (profile) {
                    profile.endTime = Date.now();
                    profile.totalDuration = profile.endTime - profile.startTime;
                    profile.averageOperationTime = profile.operations.reduce((sum, op) => sum + op.duration, 0) / profile.operations.length;
                }
            },

            getProfileReport: (name) => {
                const profile = this.profiles.get(name);
                if (!profile) return null;

                return {
                    name: profile.name,
                    duration: profile.totalDuration,
                    operations: profile.operations.length,
                    averageOperationTime: profile.averageOperationTime,
                    memoryPeaks: profile.memoryUsage.map(m => m.usage.heapUsed).sort((a, b) => b - a).slice(0, 5)
                };
            }
        };
    }

    createConfigAnomalyDetector() {
        return {
            baseline: {},
            threshold: 2.0,

            train: (configs) => {
                // Calculate baseline statistics
                const stats = {};

                for (const config of configs) {
                    for (const [key, value] of Object.entries(config)) {
                        if (!stats[key]) {
                            stats[key] = [];
                        }
                        if (typeof value === 'number') {
                            stats[key].push(value);
                        }
                    }
                }

                for (const [key, values] of Object.entries(stats)) {
                    const mean = values.reduce((a, b) => a + b, 0) / values.length;
                    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
                    const std = Math.sqrt(variance);

                    this.baseline[key] = { mean, std };
                }
            },

            detect: (config) => {
                const anomalies = [];

                for (const [key, value] of Object.entries(config)) {
                    if (typeof value === 'number' && this.baseline[key]) {
                        const { mean, std } = this.baseline[key];
                        const deviation = Math.abs(value - mean);
                        const zScore = deviation / std;

                        if (zScore > this.threshold) {
                            anomalies.push({
                                key,
                                value,
                                expected: mean,
                                deviation,
                                zScore,
                                severity: zScore > 3 ? 'high' : 'medium'
                            });
                        }
                    }
                }

                return anomalies;
            },

            isAnomalous: (config) => {
                return this.detect(config).length > 0;
            }
        };
    }

    createConfigRecommender() {
        return {
            recommendations: [],

            addRecommendation: (condition, recommendation) => {
                this.recommendations.push({ condition, recommendation });
            },

            getRecommendations: (config) => {
                return this.recommendations
                    .filter(rec => rec.condition(config))
                    .map(rec => rec.recommendation);
            },

            addDefaultRecommendations: () => {
                this.addRecommendation(
                    (config) => !config.database?.password,
                    {
                        type: 'security',
                        message: 'Consider adding a password to your database configuration',
                        severity: 'high'
                    }
                );

                this.addRecommendation(
                    (config) => config.port && config.port < 1024,
                    {
                        type: 'security',
                        message: 'Using privileged ports (< 1024) may require special permissions',
                        severity: 'medium'
                    }
                );

                this.addRecommendation(
                    (config) => !config.logging,
                    {
                        type: 'monitoring',
                        message: 'Consider adding logging configuration for better observability',
                        severity: 'low'
                    }
                );
            }
        };
    }

    createConfigVersionManager() {
        return {
            versions: new Map(),
            currentVersion: '1.0.0',

            createVersion: (version, changes) => {
                this.versions.set(version, {
                    version,
                    changes,
                    config: JSON.parse(JSON.stringify(this.config)),
                    created: new Date()
                });
            },

            switchVersion: (version) => {
                const versionData = this.versions.get(version);
                if (!versionData) {
                    throw new Error(`Version ${version} not found`);
                }

                this.config = JSON.parse(JSON.stringify(versionData.config));
                this.currentVersion = version;
                this.saveConfig();
            },

            getVersionDiff: (fromVersion, toVersion) => {
                const fromData = this.versions.get(fromVersion);
                const toData = this.versions.get(toVersion);

                if (!fromData || !toData) {
                    throw new Error('Version not found');
                }

                return this.createConfigDiff(fromData.config, toData.config);
            },

            listVersions: () => {
                return Array.from(this.versions.values()).sort((a, b) =>
                    new Date(b.created) - new Date(a.created)
                );
            }
        };
    }

    createConfigBackupManager() {
        return {
            backups: [],
            maxBackups: 10,

            createBackup: (name = null) => {
                const backupName = name || `backup_${new Date().toISOString().replace(/:/g, '-')}`;
                const backup = {
                    name: backupName,
                    config: JSON.parse(JSON.stringify(this.config)),
                    timestamp: new Date(),
                    checksum: this.calculateConfigChecksum()
                };

                this.backups.push(backup);

                // Limit number of backups
                if (this.backups.length > this.maxBackups) {
                    this.backups.shift();
                }

                return backup;
            },

            restoreBackup: (name) => {
                const backup = this.backups.find(b => b.name === name);
                if (!backup) {
                    throw new Error(`Backup ${name} not found`);
                }

                this.config = JSON.parse(JSON.stringify(backup.config));
                this.saveConfig();

                return this.config;
            },

            listBackups: () => {
                return this.backups.map(backup => ({
                    name: backup.name,
                    timestamp: backup.timestamp,
                    size: JSON.stringify(backup.config).length
                }));
            },

            deleteBackup: (name) => {
                const index = this.backups.findIndex(b => b.name === name);
                if (index > -1) {
                    this.backups.splice(index, 1);
                    return true;
                }
                return false;
            },

            calculateConfigChecksum: () => {
                const crypto = require('crypto');
                const configStr = JSON.stringify(this.config, Object.keys(this.config).sort());
                return crypto.createHash('sha256').update(configStr).digest('hex');
            }
        };
    }

    createConfigAuditor() {
        return {
            auditLog: [],
            enabled: true,

            logAccess: (action, key, userId = 'system') => {
                if (!this.enabled) return;

                this.auditLog.push({
                    timestamp: new Date(),
                    action,
                    key,
                    userId,
                    configValue: this.get(key)
                });
            },

            logChange: (action, key, oldValue, newValue, userId = 'system') => {
                if (!this.enabled) return;

                this.auditLog.push({
                    timestamp: new Date(),
                    action,
                    key,
                    oldValue,
                    newValue,
                    userId
                });
            },

            getAuditLog: (filter = {}) => {
                let logs = [...this.auditLog];

                if (filter.userId) {
                    logs = logs.filter(log => log.userId === filter.userId);
                }

                if (filter.action) {
                    logs = logs.filter(log => log.action === filter.action);
                }

                if (filter.key) {
                    logs = logs.filter(log => log.key === filter.key);
                }

                if (filter.since) {
                    logs = logs.filter(log => log.timestamp >= new Date(filter.since));
                }

                return logs;
            },

            getAccessSummary: (timeRange = '24h') => {
                const logs = this.getAuditLog({ since: new Date(Date.now() - this.parseTimeRange(timeRange)) });

                const summary = {
                    totalAccesses: logs.length,
                    byAction: {},
                    byUser: {},
                    byKey: {},
                    timeRange
                };

                for (const log of logs) {
                    summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1;
                    summary.byUser[log.userId] = (summary.byUser[log.userId] || 0) + 1;
                    summary.byKey[log.key] = (summary.byKey[log.key] || 0) + 1;
                }

                return summary;
            },

            parseTimeRange: (range) => {
                const ranges = {
                    '1h': 60 * 60 * 1000,
                    '24h': 24 * 60 * 60 * 1000,
                    '7d': 7 * 24 * 60 * 60 * 1000,
                    '30d': 30 * 24 * 60 * 60 * 1000
                };
                return ranges[range] || ranges['24h'];
            }
        };
    }

    createConfigHealthChecker() {
        return {
            checks: [],

            addCheck: (name, checkFunction) => {
                this.checks.push({ name, check: checkFunction });
            },

            runChecks: async () => {
                const results = [];

                for (const { name, check } of this.checks) {
                    try {
                        const result = await check(this.config);
                        results.push({
                            name,
                            status: result.healthy ? 'healthy' : 'unhealthy',
                            message: result.message,
                            details: result.details
                        });
                    } catch (error) {
                        results.push({
                            name,
                            status: 'error',
                            message: error.message
                        });
                    }
                }

                return {
                    overallHealth: results.every(r => r.status === 'healthy') ? 'healthy' : 'unhealthy',
                    checks: results
                };
            },

            addDefaultChecks: () => {
                this.addCheck('file_access', async (config) => {
                    const fs = require('fs');
                    const canRead = fs.existsSync(this.configPath);
                    return {
                        healthy: canRead,
                        message: canRead ? 'Config file is accessible' : 'Config file is not accessible',
                        details: { path: this.configPath }
                    };
                });

                this.addCheck('required_fields', async (config) => {
                    const required = ['port'];
                    const missing = required.filter(field => !config[field]);

                    return {
                        healthy: missing.length === 0,
                        message: missing.length === 0 ? 'All required fields present' : `Missing required fields: ${missing.join(', ')}`,
                        details: { missing }
                    };
                });

                this.addCheck('value_ranges', async (config) => {
                    const issues = [];

                    if (config.port && (config.port < 1 || config.port > 65535)) {
                        issues.push('Port out of valid range');
                    }

                    return {
                        healthy: issues.length === 0,
                        message: issues.length === 0 ? 'All values in valid ranges' : `Value range issues: ${issues.join(', ')}`,
                        details: { issues }
                    };
                });
            }
        };
    }

    createConfigPerformanceMonitor() {
        return {
            metrics: [],
            enabled: true,

            recordMetric: (operation, duration) => {
                if (!this.enabled) return;

                this.metrics.push({
                    operation,
                    duration,
                    timestamp: Date.now()
                });

                // Keep only recent metrics
                if (this.metrics.length > 1000) {
                    this.metrics = this.metrics.slice(-500);
                }
            },

            getPerformanceStats: () => {
                if (this.metrics.length === 0) return null;

                const durations = this.metrics.map(m => m.duration);
                const sortedDurations = [...durations].sort((a, b) => a - b);

                return {
                    totalOperations: this.metrics.length,
                    averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
                    medianDuration: sortedDurations[Math.floor(sortedDurations.length / 2)],
                    p95Duration: sortedDurations[Math.floor(sortedDurations.length * 0.95)],
                    p99Duration: sortedDurations[Math.floor(sortedDurations.length * 0.99)],
                    minDuration: Math.min(...durations),
                    maxDuration: Math.max(...durations)
                };
            },

            getSlowOperations: (threshold = 100) => {
                return this.metrics
                    .filter(m => m.duration > threshold)
                    .sort((a, b) => b.duration - a.duration)
                    .slice(0, 10);
            },

            resetMetrics: () => {
                this.metrics = [];
            }
        };
    }

    // Final cleanup
    destroy() {
        // Cleanup watchers, etc.
    }
}

module.exports = ConfigManager;
