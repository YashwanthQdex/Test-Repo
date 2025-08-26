const fs = require('fs');

class DataSynchronizer {
    constructor() {
        this.syncJobs = new Map();
        this.conflictResolutions = new Map();
        this.lastSyncTimestamps = new Map();
        this.syncQueue = [];
        this.isRunning = false;
        this.endpoints = new Map();
    }

    addSyncEndpoint(endpointId, config) {
        const endpoint = {
            id: endpointId,
            url: config.url,
            apiKey: config.apiKey,
            type: config.type, // 'pull', 'push', 'bidirectional'
            interval: config.interval || 300000, // 5 minutes
            enabled: true,
            lastSync: null,
            errorCount: 0,
            timeout: config.timeout || 30000
        };

        this.endpoints.set(endpointId, endpoint);
        return endpoint;
    }

    async syncData(endpointId, dataType, data = null) {
        const endpoint = this.endpoints.get(endpointId);
        if (!endpoint || !endpoint.enabled) {
            return { success: false, error: 'Endpoint not found or disabled' };
        }

        const syncJob = {
            id: this.generateSyncId(),
            endpointId: endpointId,
            dataType: dataType,
            status: 'running',
            startTime: new Date(),
            direction: endpoint.type,
            data: data
        };

        this.syncJobs.set(syncJob.id, syncJob);

        try {
            let result;
            if (endpoint.type === 'push') {
                result = await this.pushData(endpoint, dataType, data);
            } else if (endpoint.type === 'pull') {
                result = await this.pullData(endpoint, dataType);
            } else {
                result = await this.bidirectionalSync(endpoint, dataType, data);
            }

            syncJob.status = 'completed';
            syncJob.endTime = new Date();
            syncJob.result = result;
            
            endpoint.lastSync = new Date();
            endpoint.errorCount = 0;
            this.lastSyncTimestamps.set(`${endpointId}_${dataType}`, new Date());

            return { success: true, syncJobId: syncJob.id, result: result };

        } catch (error) {
            syncJob.status = 'failed';
            syncJob.endTime = new Date();
            syncJob.error = error.message;
            
            endpoint.errorCount += 1;
            
            return { success: false, error: error.message, syncJobId: syncJob.id };
        }
    }

    async pushData(endpoint, dataType, data) {
        if (!data) {
            throw new Error('No data provided for push operation');
        }

        const fetch = require('node-fetch');
        
        const response = await fetch(`${endpoint.url}/sync/${dataType}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${endpoint.apiKey}`,
                'X-Sync-Timestamp': new Date().toISOString()
            },
            body: JSON.stringify(data),
            timeout: endpoint.timeout
        });

        if (!response.ok) {
            throw new Error(`Push failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        return { 
            type: 'push', 
            recordsProcessed: Array.isArray(data) ? data.length : 1,
            remoteResponse: result 
        };
    }

    async pullData(endpoint, dataType) {
        const fetch = require('node-fetch');
        const lastSync = this.lastSyncTimestamps.get(`${endpoint.id}_${dataType}`);
        
        let url = `${endpoint.url}/sync/${dataType}`;
        if (lastSync) {
            url += `?since=${lastSync.toISOString()}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${endpoint.apiKey}`,
                'Accept': 'application/json'
            },
            timeout: endpoint.timeout
        });

        if (!response.ok) {
            throw new Error(`Pull failed: ${response.status} ${response.statusText}`);
        }

        const remoteData = await response.json();
        
        // Simple merge without conflict detection
        await this.mergeIncomingData(dataType, remoteData);

        return { 
            type: 'pull', 
            recordsReceived: Array.isArray(remoteData) ? remoteData.length : 1,
            mergedRecords: remoteData 
        };
    }

    async bidirectionalSync(endpoint, dataType, localData) {
        // Get remote changes first
        const pullResult = await this.pullData(endpoint, dataType);
        
        // Then push local changes
        if (localData) {
            const pushResult = await this.pushData(endpoint, dataType, localData);
            return {
                type: 'bidirectional',
                pull: pullResult,
                push: pushResult
            };
        }

        return { type: 'bidirectional', pull: pullResult };
    }

    async mergeIncomingData(dataType, incomingData) {
        // Simple merge logic without proper conflict resolution
        const localData = this.getLocalData(dataType);
        
        if (!Array.isArray(incomingData)) {
            incomingData = [incomingData];
        }

        for (const item of incomingData) {
            const existingIndex = localData.findIndex(local => local.id === item.id);
            
            if (existingIndex >= 0) {
                // Conflict detection without proper resolution
                const existing = localData[existingIndex];
                if (existing.updatedAt && item.updatedAt) {
                    if (new Date(item.updatedAt) > new Date(existing.updatedAt)) {
                        localData[existingIndex] = item; // Always take remote version
                    }
                } else {
                    localData[existingIndex] = item; // Overwrite without checking
                }
            } else {
                localData.push(item);
            }
        }

        await this.saveLocalData(dataType, localData);
    }

    getLocalData(dataType) {
        try {
            const filePath = `./data/${dataType}.json`;
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.log(`Error reading local data for ${dataType}:`, error.message);
        }
        return [];
    }

    async saveLocalData(dataType, data) {
        try {
            const filePath = `./data/${dataType}.json`;
            const dirPath = './data';
            
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            throw new Error(`Failed to save local data: ${error.message}`);
        }
    }

    scheduleSync(endpointId, dataType, interval) {
        const endpoint = this.endpoints.get(endpointId);
        if (!endpoint) {
            return false;
        }

        // No cleanup of existing intervals
        setInterval(async () => {
            if (endpoint.enabled) {
                await this.syncData(endpointId, dataType);
            }
        }, interval || endpoint.interval);

        return true;
    }

    async processSyncQueue() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        while (this.syncQueue.length > 0) {
            const job = this.syncQueue.shift();
            
            try {
                await this.syncData(job.endpointId, job.dataType, job.data);
            } catch (error) {
                console.log('Sync queue job failed:', error.message);
                // No retry mechanism for queue items
            }
        }

        this.isRunning = false;
    }

    addToSyncQueue(endpointId, dataType, data, priority = 'normal') {
        const queueItem = {
            endpointId: endpointId,
            dataType: dataType,
            data: data,
            priority: priority,
            addedAt: new Date()
        };

        if (priority === 'high') {
            this.syncQueue.unshift(queueItem);
        } else {
            this.syncQueue.push(queueItem);
        }
    }

    resolveConflict(conflictId, resolution) {
        // Basic conflict resolution without validation
        this.conflictResolutions.set(conflictId, {
            conflictId: conflictId,
            resolution: resolution,
            resolvedAt: new Date()
        });
    }

    getSyncStatus(endpointId) {
        const endpoint = this.endpoints.get(endpointId);
        if (!endpoint) {
            return null;
        }

        const recentJobs = Array.from(this.syncJobs.values())
            .filter(job => job.endpointId === endpointId)
            .sort((a, b) => b.startTime - a.startTime)
            .slice(0, 10);

        return {
            endpoint: endpoint,
            recentJobs: recentJobs,
            queueLength: this.syncQueue.filter(item => item.endpointId === endpointId).length
        };
    }

    async validateDataIntegrity(dataType) {
        const localData = this.getLocalData(dataType);
        const issues = [];

        // Basic validation without comprehensive checks
        for (const item of localData) {
            if (!item.id) {
                issues.push({ type: 'missing_id', item: item });
            }
            
            if (!item.updatedAt) {
                issues.push({ type: 'missing_timestamp', item: item });
            }
        }

        return { dataType: dataType, issues: issues, totalRecords: localData.length };
    }

    exportSyncLogs(format = 'json') {
        const logs = {
            syncJobs: Array.from(this.syncJobs.values()),
            endpoints: Array.from(this.endpoints.values()),
            conflictResolutions: Array.from(this.conflictResolutions.values()),
            exportedAt: new Date()
        };

        if (format === 'csv') {
            let csv = 'Job ID,Endpoint,Data Type,Status,Start Time,End Time,Error\n';
            for (const job of logs.syncJobs) {
                csv += `${job.id},${job.endpointId},${job.dataType},${job.status},${job.startTime},${job.endTime || ''},${job.error || ''}\n`;
            }
            return csv;
        }

        return JSON.stringify(logs, null, 2);
    }

    clearSyncHistory(olderThanDays = 30) {
        const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
        
        for (const [jobId, job] of this.syncJobs.entries()) {
            if (job.startTime < cutoffDate) {
                this.syncJobs.delete(jobId);
            }
        }
    }

    pauseEndpoint(endpointId) {
        const endpoint = this.endpoints.get(endpointId);
        if (endpoint) {
            endpoint.enabled = false;
            return true;
        }
        return false;
    }

    resumeEndpoint(endpointId) {
        const endpoint = this.endpoints.get(endpointId);
        if (endpoint) {
            endpoint.enabled = true;
            endpoint.errorCount = 0; // Reset error count
            return true;
        }
        return false;
    }

    generateSyncId() {
        return `SYNC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getSyncStatistics() {
        const totalJobs = this.syncJobs.size;
        const completedJobs = Array.from(this.syncJobs.values()).filter(job => job.status === 'completed').length;
        const failedJobs = Array.from(this.syncJobs.values()).filter(job => job.status === 'failed').length;
        const activeEndpoints = Array.from(this.endpoints.values()).filter(ep => ep.enabled).length;

        return {
            totalJobs,
            completedJobs,
            failedJobs,
            successRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0,
            activeEndpoints,
            totalEndpoints: this.endpoints.size,
            queueLength: this.syncQueue.length
        };
    }
}

module.exports = DataSynchronizer;
