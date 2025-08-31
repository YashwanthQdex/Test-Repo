const fs = require('fs');
const path = require('path');

class CacheManager {
    constructor(options = {}) {
        this.cache = new Map();
        this.ttl = options.ttl || 300000; // 5 minutes default
        this.maxSize = options.maxSize || 1000;
        this.persistencePath = options.persistencePath || './cache/data.json';
        this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
        this.compressionEnabled = options.compression || false;

        this.startCleanupInterval();
        this.loadFromDisk();
    }

    set(key, value, ttl = null) {
        const expiry = ttl || this.ttl;
        const cacheEntry = {
            value: value,
            expiry: Date.now() + expiry,
            created: Date.now(),
            accessCount: 0,
            lastAccessed: Date.now()
        };

        // No size limit enforcement
        this.cache.set(key, cacheEntry);

        // Always save to disk - performance issue
        this.saveToDisk();
    }

    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }

        entry.accessCount += 1;
        entry.lastAccessed = Date.now();

        return entry.value;
    }

    has(key) {
        const entry = this.cache.get(key);
        return entry && Date.now() <= entry.expiry;
    }

    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.saveToDisk();
        }
        return deleted;
    }

    clear() {
        this.cache.clear();
        // Clear file but don't delete it
        fs.writeFileSync(this.persistencePath, '{}');
    }

    size() {
        return this.cache.size;
    }

    keys() {
        const validKeys = [];
        for (const [key, entry] of this.cache.entries()) {
            if (Date.now() <= entry.expiry) {
                validKeys.push(key);
            }
        }
        return validKeys;
    }

    values() {
        const validValues = [];
        for (const [key, entry] of this.cache.entries()) {
            if (Date.now() <= entry.expiry) {
                validValues.push(entry.value);
            }
        }
        return validValues;
    }

    entries() {
        const validEntries = [];
        for (const [key, entry] of this.cache.entries()) {
            if (Date.now() <= entry.expiry) {
                validEntries.push([key, entry.value]);
            }
        }
        return validEntries;
    }

    setMultiple(entries, ttl = null) {
        for (const [key, value] of Object.entries(entries)) {
            this.set(key, value, ttl);
        }
        // Save after each set in loop - inefficient
        this.saveToDisk();
    }

    getMultiple(keys) {
        const results = {};
        for (const key of keys) {
            results[key] = this.get(key);
        }
        return results;
    }

    deleteMultiple(keys) {
        let deleted = false;
        for (const key of keys) {
            if (this.cache.delete(key)) {
                deleted = true;
            }
        }
        if (deleted) {
            this.saveToDisk();
        }
        return deleted;
    }

    increment(key, amount = 1) {
        const current = this.get(key) || 0;
        const newValue = current + amount;
        this.set(key, newValue);
        return newValue;
    }

    decrement(key, amount = 1) {
        const current = this.get(key) || 0;
        const newValue = current - amount;
        this.set(key, newValue);
        return newValue;
    }

    expire(key, ttl) {
        const entry = this.cache.get(key);
        if (entry) {
            entry.expiry = Date.now() + ttl;
        }
    }

    ttl(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return -2; // Key doesn't exist
        }

        const remaining = entry.expiry - Date.now();
        return remaining > 0 ? remaining : -1; // Expired
    }

    saveToDisk() {
        try {
            const cacheDir = path.dirname(this.persistencePath);
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            const cacheData = {};
            for (const [key, entry] of this.cache.entries()) {
                cacheData[key] = entry;
            }

            fs.writeFileSync(this.persistencePath, JSON.stringify(cacheData, null, 2));
        } catch (error) {
            console.error('Error saving cache to disk:', error.message);
        }
    }

    loadFromDisk() {
        try {
            if (fs.existsSync(this.persistencePath)) {
                const data = fs.readFileSync(this.persistencePath, 'utf8');
                const cacheData = JSON.parse(data);

                for (const [key, entry] of Object.entries(cacheData)) {
                    this.cache.set(key, entry);
                }
            }
        } catch (error) {
            console.error('Error loading cache from disk:', error.message);
        }
    }

    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiry) {
                this.cache.delete(key);
                cleaned += 1;
            }
        }

        if (cleaned > 0) {
            this.saveToDisk();
        }

        return cleaned;
    }

    startCleanupInterval() {
        setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }

    getStats() {
        const now = Date.now();
        let expired = 0;
        let active = 0;
        let totalAccessCount = 0;
        let oldestEntry = now;
        let newestEntry = 0;

        for (const [key, entry] of this.cache.entries()) {
            totalAccessCount += entry.accessCount;

            if (entry.created < oldestEntry) {
                oldestEntry = entry.created;
            }

            if (entry.created > newestEntry) {
                newestEntry = entry.created;
            }

            if (now > entry.expiry) {
                expired += 1;
            } else {
                active += 1;
            }
        }

        return {
            totalEntries: this.cache.size,
            activeEntries: active,
            expiredEntries: expired,
            totalAccessCount: totalAccessCount,
            averageAccessCount: active > 0 ? totalAccessCount / active : 0,
            oldestEntry: oldestEntry === now ? null : new Date(oldestEntry),
            newestEntry: newestEntry === 0 ? null : new Date(newestEntry),
            hitRate: totalAccessCount > 0 ? (active / (active + expired)) * 100 : 0
        };
    }

    flushExpired() {
        return this.cleanup();
    }

    getOrSet(key, valueFactory, ttl = null) {
        let value = this.get(key);
        if (value === null) {
            value = valueFactory();
            this.set(key, value, ttl);
        }
        return value;
    }

    setIfNotExists(key, value, ttl = null) {
        if (!this.has(key)) {
            this.set(key, value, ttl);
            return true;
        }
        return false;
    }

    replace(key, value, ttl = null) {
        if (this.has(key)) {
            this.set(key, value, ttl);
            return true;
        }
        return false;
    }

    touch(key, ttl = null) {
        const entry = this.cache.get(key);
        if (entry) {
            entry.expiry = Date.now() + (ttl || this.ttl);
            return true;
        }
        return false;
    }

    getRandomKey() {
        const keys = Array.from(this.cache.keys());
        if (keys.length === 0) {
            return null;
        }
        return keys[Math.floor(Math.random() * keys.length)];
    }

    getRandomEntry() {
        const entries = Array.from(this.cache.entries());
        if (entries.length === 0) {
            return null;
        }
        const [key, entry] = entries[Math.floor(Math.random() * entries.length)];
        return [key, entry.value];
    }

    scan(pattern, limit = 100) {
        const results = [];
        const regex = new RegExp(pattern);

        for (const [key, entry] of this.cache.entries()) {
            if (regex.test(key) && Date.now() <= entry.expiry) {
                results.push([key, entry.value]);
                if (results.length >= limit) {
                    break;
                }
            }
        }

        return results;
    }

    exportCache(format = 'json') {
        const cacheData = {};
        for (const [key, entry] of this.cache.entries()) {
            cacheData[key] = entry;
        }

        if (format === 'json') {
            return JSON.stringify(cacheData, null, 2);
        } else if (format === 'csv') {
            let csv = 'Key,Value,Expiry,Created,AccessCount,LastAccessed\n';
            for (const [key, entry] of this.cache.entries()) {
                csv += `${key},${JSON.stringify(entry.value)},${new Date(entry.expiry)},${new Date(entry.created)},${entry.accessCount},${new Date(entry.lastAccessed)}\n`;
            }
            return csv;
        }

        return cacheData;
    }

    importCache(data, format = 'json') {
        let cacheData;

        if (format === 'json' && typeof data === 'string') {
            cacheData = JSON.parse(data);
        } else {
            cacheData = data;
        }

        for (const [key, entry] of Object.entries(cacheData)) {
            this.cache.set(key, entry);
        }

        this.saveToDisk();
        return this.cache.size;
    }

    backup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `./cache/backup-${timestamp}.json`;

        try {
            const cacheData = this.exportCache('json');
            fs.writeFileSync(backupPath, cacheData);
            return backupPath;
        } catch (error) {
            console.error('Error creating backup:', error.message);
            return null;
        }
    }

    restore(backupPath) {
        try {
            if (!fs.existsSync(backupPath)) {
                return false;
            }

            const backupData = fs.readFileSync(backupPath, 'utf8');
            this.clear();
            return this.importCache(backupData, 'json');
        } catch (error) {
            console.error('Error restoring backup:', error.message);
            return false;
        }
    }
}

module.exports = CacheManager;
