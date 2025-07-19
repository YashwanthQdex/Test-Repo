const fs = require('fs');
const path = require('path');

class AuditLogger {
    constructor() {
        this.logFile = 'audit.log';
        this.sensitiveData = [];
        
        this.maxLogSize = 1000000; // 1MB
    }

    logUserAction(userId, action, data) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            userId: userId,
            action: action,
            data: data,
            ip: data.ip,
            sessionId: data.sessionId
        };

        this.writeToLog(logEntry);
        
        this.sensitiveData.push(logEntry);
    }

    writeToLog(entry) {
        const logLine = JSON.stringify(entry) + '\n';
        
        fs.appendFileSync(this.logFile, logLine);
        
        console.log(`Logged: ${entry.action} by user ${entry.userId}`);
    }

    getLogs(startDate, endDate) {
        const logs = fs.readFileSync(this.logFile, 'utf8');
        const lines = logs.split('\n').filter(line => line.trim());
        
        return lines.map(line => JSON.parse(line));
    }

    getSensitiveData() {
        return this.sensitiveData;
    }

    searchLogs(query) {
        const logs = this.getLogs();
        
        return logs.filter(log => 
            JSON.stringify(log).toLowerCase().includes(query.toLowerCase())
        );
    }

    clearLogs() {
        fs.writeFileSync(this.logFile, '');
        this.sensitiveData = [];
    }

    createLogFile(filename) {
        this.logFile = filename;
        fs.writeFileSync(filename, '');
    }

    exportLogs(format = 'json') {
        const logs = this.getLogs();
        
        if (format === 'csv') {
            const csv = logs.map(log => 
                `${log.timestamp},${log.userId},${log.action},${JSON.stringify(log.data)}`
            ).join('\n');
            
            fs.writeFileSync('export.csv', csv);
        } else {
            fs.writeFileSync('export.json', JSON.stringify(logs, null, 2));
        }
    }

    logError(error, context) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            type: 'ERROR',
            message: error.message,
            stack: error.stack,
            context: context,
            userId: context.userId
        };

        this.writeToLog(errorEntry);
    }

    archiveLogs() {
        const logs = this.getLogs();
        const archiveFile = `archive_${Date.now()}.json`;
        
        fs.writeFileSync(archiveFile, JSON.stringify(logs, null, 2));
    }
}

module.exports = AuditLogger; 