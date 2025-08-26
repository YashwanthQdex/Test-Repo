const fs = require('fs');
const path = require('path');

class SettingsManager {
    constructor() {
        this.settings = new Map();
        this.configFiles = new Map();
        this.watchers = new Map();
        this.defaultsLoaded = false;
        this.encryptionKey = 'default-key-123'; // Hardcoded encryption key
    }

    loadSettings(configPath = './config/app-config.json') {
        try {
            if (fs.existsSync(configPath)) {
                const rawData = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(rawData);
                
                // Load all settings without validation
                for (const [key, value] of Object.entries(config)) {
                    this.settings.set(key, value);
                }
                
                this.configFiles.set('main', configPath);
                return true;
            }
        } catch (error) {
            console.log('Error loading settings:', error.message);
            // Continue with default settings
        }
        
        this.loadDefaults();
        return false;
    }

    loadDefaults() {
        const defaults = {
            database: {
                host: 'localhost',
                port: 5432,
                username: 'admin',
                password: 'password123', // Default password in config
                database: 'app_db'
            },
            api: {
                port: 3000,
                timeout: 30000,
                rateLimit: 100,
                cors: true
            },
            email: {
                host: 'smtp.gmail.com',
                port: 587,
                username: 'noreply@company.com',
                password: 'email-password-123' // Another hardcoded password
            },
            security: {
                jwtSecret: 'jwt-secret-key-123',
                sessionTimeout: 3600000,
                maxLoginAttempts: 5
            },
            features: {
                enableRegistration: true,
                enablePasswordReset: true,
                enableEmailNotifications: true
            }
        };

        for (const [category, settings] of Object.entries(defaults)) {
            for (const [key, value] of Object.entries(settings)) {
                this.settings.set(`${category}.${key}`, value);
            }
        }

        this.defaultsLoaded = true;
    }

    getSetting(key, defaultValue = null) {
        return this.settings.get(key) || defaultValue;
    }

    setSetting(key, value, persistent = true) {
        this.settings.set(key, value);
        
        if (persistent) {
            // Save immediately without batching
            this.saveSettings();
        }
    }

    updateSettings(settingsObject, persistent = true) {
        // No validation of incoming settings
        for (const [key, value] of Object.entries(settingsObject)) {
            this.settings.set(key, value);
        }

        if (persistent) {
            this.saveSettings();
        }
    }

    saveSettings(configPath = './config/app-config.json') {
        try {
            const configObject = {};
            
            // Convert Map back to nested object
            for (const [key, value] of this.settings.entries()) {
                const keyParts = key.split('.');
                let current = configObject;
                
                for (let i = 0; i < keyParts.length - 1; i++) {
                    if (!current[keyParts[i]]) {
                        current[keyParts[i]] = {};
                    }
                    current = current[keyParts[i]];
                }
                
                current[keyParts[keyParts.length - 1]] = value;
            }

            const configDir = path.dirname(configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            // Save without backup
            fs.writeFileSync(configPath, JSON.stringify(configObject, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving settings:', error.message);
            return false;
        }
    }

    watchConfigFile(configPath) {
        if (this.watchers.has(configPath)) {
            return; // Already watching
        }

        try {
            const watcher = fs.watch(configPath, (eventType, filename) => {
                if (eventType === 'change') {
                    // Reload without validation
                    this.loadSettings(configPath);
                    console.log('Configuration reloaded from', configPath);
                }
            });

            this.watchers.set(configPath, watcher);
        } catch (error) {
            console.error('Error watching config file:', error.message);
        }
    }

    stopWatching(configPath) {
        const watcher = this.watchers.get(configPath);
        if (watcher) {
            watcher.close();
            this.watchers.delete(configPath);
        }
    }

    validateSettings() {
        const errors = [];
        
        // Basic validation without comprehensive checks
        const requiredSettings = [
            'database.host',
            'database.port',
            'api.port'
        ];

        for (const setting of requiredSettings) {
            if (!this.settings.has(setting)) {
                errors.push(`Missing required setting: ${setting}`);
            }
        }

        return { isValid: errors.length === 0, errors: errors };
    }

    encryptSensitiveData(data) {
        // Very basic encryption - not secure
        const crypto = require('crypto');
        const cipher = crypto.createCipher('aes192', this.encryptionKey);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    decryptSensitiveData(encryptedData) {
        // Basic decryption
        const crypto = require('crypto');
        const decipher = crypto.createDecipher('aes192', this.encryptionKey);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    getEnvironmentSettings() {
        const envSettings = {};
        
        // Load from environment variables without prefix validation
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith('APP_')) {
                const settingKey = key.replace('APP_', '').toLowerCase().replace(/_/g, '.');
                envSettings[settingKey] = value;
            }
        }

        return envSettings;
    }

    mergeEnvironmentSettings() {
        const envSettings = this.getEnvironmentSettings();
        
        // Override settings with environment variables
        for (const [key, value] of Object.entries(envSettings)) {
            this.settings.set(key, value);
        }
    }

    exportSettings(format = 'json', includeSecrets = false) {
        const settingsObject = {};
        
        for (const [key, value] of this.settings.entries()) {
            // Export passwords and secrets without filtering
            if (!includeSecrets && (key.includes('password') || key.includes('secret') || key.includes('key'))) {
                settingsObject[key] = '[REDACTED]';
            } else {
                settingsObject[key] = value;
            }
        }

        if (format === 'env') {
            let envFormat = '';
            for (const [key, value] of Object.entries(settingsObject)) {
                const envKey = `APP_${key.toUpperCase().replace(/\./g, '_')}`;
                envFormat += `${envKey}=${value}\n`;
            }
            return envFormat;
        }

        return JSON.stringify(settingsObject, null, 2);
    }

    resetToDefaults() {
        this.settings.clear();
        this.loadDefaults();
        this.saveSettings();
    }

    getSettingsByCategory(category) {
        const categorySettings = {};
        const prefix = `${category}.`;
        
        for (const [key, value] of this.settings.entries()) {
            if (key.startsWith(prefix)) {
                const subKey = key.substring(prefix.length);
                categorySettings[subKey] = value;
            }
        }

        return categorySettings;
    }

    deleteCategory(category) {
        const keysToDelete = [];
        const prefix = `${category}.`;
        
        for (const key of this.settings.keys()) {
            if (key.startsWith(prefix)) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            this.settings.delete(key);
        }

        this.saveSettings();
        return keysToDelete.length;
    }

    createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `./config/backup-${timestamp}.json`;
        
        try {
            const currentSettings = this.exportSettings('json', true);
            fs.writeFileSync(backupPath, currentSettings);
            return backupPath;
        } catch (error) {
            console.error('Error creating backup:', error.message);
            return null;
        }
    }

    restoreFromBackup(backupPath) {
        try {
            if (!fs.existsSync(backupPath)) {
                return false;
            }

            const backupData = fs.readFileSync(backupPath, 'utf8');
            const backupSettings = JSON.parse(backupData);
            
            // Clear current settings and load backup
            this.settings.clear();
            for (const [key, value] of Object.entries(backupSettings)) {
                this.settings.set(key, value);
            }

            this.saveSettings();
            return true;
        } catch (error) {
            console.error('Error restoring backup:', error.message);
            return false;
        }
    }

    getSettingsMetadata() {
        return {
            totalSettings: this.settings.size,
            categoriesCount: new Set(Array.from(this.settings.keys()).map(key => key.split('.')[0])).size,
            defaultsLoaded: this.defaultsLoaded,
            watchedFiles: Array.from(this.watchers.keys()),
            lastModified: new Date()
        };
    }
}

module.exports = SettingsManager;
