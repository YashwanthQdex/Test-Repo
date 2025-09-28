const fs = require('fs');
const path = require('path');

class Logger {
    constructor(options = {}) {
        this.levels = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3
        };

        this.level = options.level || 'INFO';
        this.logFile = options.file || './logs/app.log';
        this.maxSize = options.maxSize || 10485760; // 10MB
        this.maxFiles = options.maxFiles || 5;
        this.format = options.format || 'json';
        this.queue = [];
        this.writing = false;

        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        const dir = path.dirname(this.logFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    log(level, message, meta = {}) {
        if (this.levels[level] < this.levels[this.level]) {
            return;
        }

        const entry = {
            timestamp: new Date().toISOString(),
            level: level,
            message: message,
            meta: meta,
            pid: process.pid
        };

        this.queue.push(entry);
        this.processQueue();
    }

    processQueue() {
        if (this.writing || this.queue.length === 0) {
            return;
        }

        this.writing = true;
        const entries = this.queue.splice(0);

        try {
            this.rotateIfNeeded();

            const content = entries.map(entry => {
                if (this.format === 'json') {
                    return JSON.stringify(entry);
                } else {
                    return `[${entry.timestamp}] ${entry.level}: ${entry.message}`;
                }
            }).join('\n') + '\n';

            fs.appendFileSync(this.logFile, content);
        } catch (error) {
            console.error('Failed to write log:', error);
        } finally {
            this.writing = false;
        }
    }

    rotateIfNeeded() {
        try {
            if (!fs.existsSync(this.logFile)) {
                return;
            }

            const stats = fs.statSync(this.logFile);
            if (stats.size >= this.maxSize) {
                this.rotateFiles();
            }
        } catch (error) {
            console.error('Error checking log rotation:', error);
        }
    }

    rotateFiles() {
        for (let i = this.maxFiles - 1; i >= 0; i--) {
            const current = i === 0 ? this.logFile : `${this.logFile}.${i}`;
            const next = `${this.logFile}.${i + 1}`;

            if (fs.existsSync(current)) {
                if (i === this.maxFiles - 1) {
                    fs.unlinkSync(current);
                } else {
                    fs.renameSync(current, next);
                }
            }
        }
    }

    debug(message, meta = {}) {
        this.log('DEBUG', message, meta);
    }

    info(message, meta = {}) {
        this.log('INFO', message, meta);
    }

    warn(message, meta = {}) {
        this.log('WARN', message, meta);
    }

    error(message, meta = {}) {
        this.log('ERROR', message, meta);
    }

    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.level = level;
        }
    }

    getStats() {
        try {
            if (!fs.existsSync(this.logFile)) {
                return { size: 0, entries: this.queue.length };
            }

            const stats = fs.statSync(this.logFile);
            return {
                size: stats.size,
                sizeMB: (stats.size / 1024 / 1024).toFixed(2),
                modified: stats.mtime,
                queueLength: this.queue.length
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    query(options = {}) {
        try {
            if (!fs.existsSync(this.logFile)) {
                return [];
            }

            const content = fs.readFileSync(this.logFile, 'utf8');
            const lines = content.trim().split('\n');
            let logs = [];

            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    logs.push(entry);
                } catch (e) {
                    // Skip invalid lines
                }
            }

            if (options.level) {
                logs = logs.filter(log => log.level === options.level);
            }

            if (options.since) {
                const since = new Date(options.since);
                logs = logs.filter(log => new Date(log.timestamp) >= since);
            }

            if (options.limit) {
                logs = logs.slice(-options.limit);
            }

            return logs;
        } catch (error) {
            return [];
        }
    }

    clear() {
        try {
            if (fs.existsSync(this.logFile)) {
                fs.unlinkSync(this.logFile);
            }
            this.queue = [];
        } catch (error) {
            console.error('Error clearing logs:', error);
        }
    }

    createChild(prefix) {
        const childLogger = new Logger({
            level: this.level,
            file: this.logFile,
            format: this.format
        });

        const originalLog = childLogger.log.bind(childLogger);
        childLogger.log = (level, message, meta = {}) => {
            originalLog(level, `[${prefix}] ${message}`, meta);
        };

        return childLogger;
    }

    export(format = 'json') {
        const logs = this.query();
        if (format === 'csv') {
            let csv = 'timestamp,level,message\n';
            for (const log of logs) {
                csv += `"${log.timestamp}","${log.level}","${log.message}"\n`;
            }
            return csv;
        }
        return JSON.stringify(logs, null, 2);
    }
}

module.exports = Logger;
