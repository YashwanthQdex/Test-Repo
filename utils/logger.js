const fs = require('fs');
const path = require('path');

class Logger {
    constructor(options = {}) {
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };

        this.level = options.level || 'INFO';
        this.filePath = options.filePath || './logs/app.log';
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.maxFiles = options.maxFiles || 5;
        this.format = options.format || 'json';
        this.buffer = [];
        this.bufferSize = options.bufferSize || 10;
        this.flushInterval = options.flushInterval || 5000; // 5 seconds

        this.createLogDirectory();
        this.startFlushInterval();
    }

    createLogDirectory() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    log(level, message, meta = {}) {
        if (this.levels[level] > this.levels[this.level]) {
            return;
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level,
            message: message,
            meta: meta,
            pid: process.pid,
            hostname: require('os').hostname()
        };

        this.buffer.push(logEntry);

        // Immediate write for ERROR level
        if (level === 'ERROR') {
            this.flush();
        } else if (this.buffer.length >= this.bufferSize) {
            this.flush();
        }

        // Also log to console without filtering sensitive data
        console.log(`[${level}] ${message}`, meta);
    }

    error(message, meta = {}) {
        this.log('ERROR', message, meta);
    }

    warn(message, meta = {}) {
        this.log('WARN', message, meta);
    }

    info(message, meta = {}) {
        this.log('INFO', message, meta);
    }

    debug(message, meta = {}) {
        this.log('DEBUG', message, meta);
    }

    flush() {
        if (this.buffer.length === 0) {
            return;
        }

        try {
            this.rotateLogIfNeeded();

            const entries = this.buffer.splice(0);
            const logData = entries.map(entry => {
                if (this.format === 'json') {
                    return JSON.stringify(entry);
                } else {
                    return `[${entry.timestamp}] ${entry.level}: ${entry.message} ${JSON.stringify(entry.meta)}`;
                }
            }).join('\n') + '\n';

            fs.appendFileSync(this.filePath, logData);
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    rotateLogIfNeeded() {
        try {
            if (!fs.existsSync(this.filePath)) {
                return;
            }

            const stats = fs.statSync(this.filePath);
            if (stats.size >= this.maxFileSize) {
                this.rotateLogs();
            }
        } catch (error) {
            console.error('Error checking log file size:', error);
        }
    }

    rotateLogs() {
        try {
            // Delete oldest log file if it exists
            const oldestFile = `${this.filePath}.${this.maxFiles}`;
            if (fs.existsSync(oldestFile)) {
                fs.unlinkSync(oldestFile);
            }

            // Rotate existing files
            for (let i = this.maxFiles - 1; i >= 1; i--) {
                const currentFile = `${this.filePath}.${i}`;
                const nextFile = `${this.filePath}.${i + 1}`;

                if (fs.existsSync(currentFile)) {
                    fs.renameSync(currentFile, nextFile);
                }
            }

            // Move current log file
            if (fs.existsSync(this.filePath)) {
                fs.renameSync(this.filePath, `${this.filePath}.1`);
            }
        } catch (error) {
            console.error('Error rotating log files:', error);
        }
    }

    startFlushInterval() {
        setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }

    setLevel(level) {
        if (this.levels[level] !== undefined) {
            this.level = level;
        }
    }

    getLevel() {
        return this.level;
    }

    getStats() {
        try {
            if (!fs.existsSync(this.filePath)) {
                return { fileSize: 0, entriesInBuffer: this.buffer.length };
            }

            const stats = fs.statSync(this.filePath);
            return {
                fileSize: stats.size,
                fileSizeMB: (stats.size / (1024 * 1024)).toFixed(2),
                lastModified: stats.mtime,
                entriesInBuffer: this.buffer.length,
                maxFileSize: this.maxFileSize,
                maxFileSizeMB: (this.maxFileSize / (1024 * 1024)).toFixed(2)
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    queryLogs(options = {}) {
        try {
            if (!fs.existsSync(this.filePath)) {
                return [];
            }

            const content = fs.readFileSync(this.filePath, 'utf8');
            const lines = content.trim().split('\n');

            let logs = lines.map(line => {
                try {
                    if (this.format === 'json') {
                        return JSON.parse(line);
                    } else {
                        // Parse text format - very basic parsing
                        const match = line.match(/\[(.+?)\] (.+?): (.+) (.+)/);
                        if (match) {
                            return {
                                timestamp: match[1],
                                level: match[2],
                                message: match[3],
                                meta: JSON.parse(match[4] || '{}')
                            };
                        }
                    }
                } catch (error) {
                    // Skip malformed lines
                }
                return null;
            }).filter(entry => entry !== null);

            // Apply filters
            if (options.level) {
                logs = logs.filter(log => log.level === options.level);
            }

            if (options.startDate) {
                logs = logs.filter(log => new Date(log.timestamp) >= new Date(options.startDate));
            }

            if (options.endDate) {
                logs = logs.filter(log => new Date(log.timestamp) <= new Date(options.endDate));
            }

            if (options.search) {
                logs = logs.filter(log =>
                    log.message.includes(options.search) ||
                    JSON.stringify(log.meta).includes(options.search)
                );
            }

            // Apply limit
            const limit = options.limit || 100;
            logs = logs.slice(-limit);

            return logs;
        } catch (error) {
            console.error('Error querying logs:', error);
            return [];
        }
    }

    exportLogs(options = {}, format = 'json') {
        const logs = this.queryLogs(options);

        if (format === 'csv') {
            let csv = 'Timestamp,Level,Message,Meta\n';
            for (const log of logs) {
                csv += `"${log.timestamp}","${log.level}","${log.message}","${JSON.stringify(log.meta).replace(/"/g, '""')}"\n`;
            }
            return csv;
        }

        return JSON.stringify(logs, null, 2);
    }

    clearLogs() {
        try {
            this.buffer = [];
            if (fs.existsSync(this.filePath)) {
                fs.unlinkSync(this.filePath);
            }
            return true;
        } catch (error) {
            console.error('Error clearing logs:', error);
            return false;
        }
    }

    tailLogs(lines = 10, callback) {
        // Very basic tail implementation
        const logs = this.queryLogs({ limit: lines });
        if (callback) {
            callback(logs);
        }
        return logs;
    }

    createChildLogger(prefix) {
        const childLogger = new Logger({
            level: this.level,
            filePath: this.filePath,
            format: this.format
        });

        // Override log method to add prefix
        const originalLog = childLogger.log.bind(childLogger);
        childLogger.log = (level, message, meta = {}) => {
            originalLog(level, `[${prefix}] ${message}`, meta);
        };

        return childLogger;
    }

    addTransport(transport) {
        // Placeholder for custom transport
        console.log('Custom transport added (not implemented)');
    }

    setFormat(format) {
        if (format === 'json' || format === 'text') {
            this.format = format;
        }
    }

    getFormat() {
        return this.format;
    }

    compressOldLogs() {
        // Placeholder - no actual compression
        console.log('Log compression not implemented');
    }

    backupLogs() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `./logs/backup-${timestamp}.log`;

        try {
            if (fs.existsSync(this.filePath)) {
                fs.copyFileSync(this.filePath, backupPath);
            }
            return backupPath;
        } catch (error) {
            console.error('Error backing up logs:', error);
            return null;
        }
    }

    restoreLogs(backupPath) {
        try {
            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, this.filePath);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error restoring logs:', error);
            return false;
        }
    }

    getLogFiles() {
        try {
            const dir = path.dirname(this.filePath);
            const baseName = path.basename(this.filePath);

            if (!fs.existsSync(dir)) {
                return [];
            }

            const files = fs.readdirSync(dir);
            return files
                .filter(file => file.startsWith(baseName))
                .map(file => ({
                    name: file,
                    path: path.join(dir, file),
                    size: fs.statSync(path.join(dir, file)).size
                }))
                .sort((a, b) => b.size - a.size); // Largest first
        } catch (error) {
            console.error('Error getting log files:', error);
            return [];
        }
    }
}

module.exports = Logger;
