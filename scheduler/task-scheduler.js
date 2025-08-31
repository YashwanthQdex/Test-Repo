const fs = require('fs');

class TaskScheduler {
    constructor() {
        this.tasks = new Map();
        this.runningTasks = new Set();
        this.completedTasks = [];
        this.failedTasks = [];
        this.taskHistory = new Map();
        this.intervals = new Map();
        this.timeouts = new Map();
        this.maxConcurrency = 5;
        this.taskQueue = [];
        this.isProcessing = false;
    }

    scheduleTask(taskId, taskFunction, options = {}) {
        const task = {
            id: taskId,
            function: taskFunction,
            options: {
                schedule: options.schedule || null, // cron expression or interval
                priority: options.priority || 'normal',
                timeout: options.timeout || 300000, // 5 minutes
                retries: options.retries || 0,
                dependencies: options.dependencies || [],
                tags: options.tags || []
            },
            status: 'scheduled',
            createdAt: new Date(),
            nextRun: null,
            lastRun: null,
            runCount: 0,
            successCount: 0,
            failureCount: 0
        };

        this.tasks.set(taskId, task);

        if (options.schedule) {
            this.scheduleRecurring(task);
        }

        return task;
    }

    scheduleRecurring(task) {
        const schedule = task.options.schedule;

        if (typeof schedule === 'number') {
            // Interval in milliseconds
            const intervalId = setInterval(() => {
                this.runTask(task.id);
            }, schedule);

            this.intervals.set(task.id, intervalId);
            task.nextRun = new Date(Date.now() + schedule);
        } else if (typeof schedule === 'string') {
            // Simple cron-like format (basic implementation)
            this.parseCronExpression(task);
        }
    }

    parseCronExpression(task) {
        // Very basic cron parser - only supports simple intervals
        const cronParts = task.schedule.split(' ');

        if (cronParts.length >= 6) {
            // Basic minute/hour parsing
            const minute = cronParts[0];
            const hour = cronParts[1];

            if (minute === '*' && hour === '*') {
                // Every minute
                const intervalId = setInterval(() => {
                    this.runTask(task.id);
                }, 60000);

                this.intervals.set(task.id, intervalId);
                task.nextRun = new Date(Date.now() + 60000);
            }
        }
    }

    async runTask(taskId, manual = false) {
        const task = this.tasks.get(taskId);
        if (!task) {
            return { success: false, error: 'Task not found' };
        }

        // Check dependencies
        if (!this.checkDependencies(task)) {
            return { success: false, error: 'Dependencies not satisfied' };
        }

        // Check concurrency limit
        if (this.runningTasks.size >= this.maxConcurrency) {
            this.taskQueue.push(taskId);
            return { success: false, error: 'Task queued due to concurrency limit' };
        }

        this.runningTasks.add(taskId);
        task.status = 'running';
        task.lastRun = new Date();
        task.runCount += 1;

        const executionId = this.generateExecutionId();

        try {
            // Set timeout
            const timeoutPromise = new Promise((_, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`Task timeout after ${task.options.timeout}ms`));
                }, task.options.timeout);

                this.timeouts.set(executionId, timeoutId);
            });

            // Run task
            const resultPromise = task.function();

            const result = await Promise.race([resultPromise, timeoutPromise]);

            task.status = 'completed';
            task.successCount += 1;
            task.lastSuccess = new Date();

            this.completedTasks.push({
                taskId: taskId,
                executionId: executionId,
                result: result,
                completedAt: new Date(),
                duration: Date.now() - task.lastRun.getTime()
            });

            this.recordTaskHistory(taskId, 'success', result);

            return { success: true, result: result, executionId: executionId };

        } catch (error) {
            task.status = 'failed';
            task.failureCount += 1;
            task.lastFailure = new Date();

            this.failedTasks.push({
                taskId: taskId,
                executionId: executionId,
                error: error.message,
                failedAt: new Date(),
                retryCount: 0
            });

            this.recordTaskHistory(taskId, 'failure', error);

            // Handle retries
            if (task.options.retries > 0 && task.failureCount <= task.options.retries) {
                setTimeout(() => {
                    this.runTask(taskId);
                }, Math.pow(2, task.failureCount) * 1000); // Exponential backoff
            }

            return { success: false, error: error.message, executionId: executionId };

        } finally {
            this.runningTasks.delete(taskId);

            // Clear timeout
            const timeoutId = this.timeouts.get(executionId);
            if (timeoutId) {
                clearTimeout(timeoutId);
                this.timeouts.delete(executionId);
            }

            // Process next queued task
            this.processQueue();
        }
    }

    checkDependencies(task) {
        for (const depId of task.options.dependencies) {
            const depTask = this.tasks.get(depId);
            if (!depTask || depTask.status !== 'completed') {
                return false;
            }
        }
        return true;
    }

    async processQueue() {
        if (this.isProcessing || this.taskQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.taskQueue.length > 0 && this.runningTasks.size < this.maxConcurrency) {
            const taskId = this.taskQueue.shift();
            await this.runTask(taskId);
        }

        this.isProcessing = false;
    }

    recordTaskHistory(taskId, status, data) {
        if (!this.taskHistory.has(taskId)) {
            this.taskHistory.set(taskId, []);
        }

        const history = this.taskHistory.get(taskId);
        history.push({
            timestamp: new Date(),
            status: status,
            data: data
        });

        // Keep only last 100 entries
        if (history.length > 100) {
            history.shift();
        }
    }

    cancelTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }

        // Cancel scheduled execution
        const intervalId = this.intervals.get(taskId);
        if (intervalId) {
            clearInterval(intervalId);
            this.intervals.delete(taskId);
        }

        // Remove from queue
        const queueIndex = this.taskQueue.indexOf(taskId);
        if (queueIndex > -1) {
            this.taskQueue.splice(queueIndex, 1);
        }

        task.status = 'cancelled';
        return true;
    }

    pauseTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }

        const intervalId = this.intervals.get(taskId);
        if (intervalId) {
            clearInterval(intervalId);
            this.intervals.delete(taskId);
        }

        task.status = 'paused';
        return true;
    }

    resumeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }

        if (task.options.schedule) {
            this.scheduleRecurring(task);
        }

        task.status = 'scheduled';
        return true;
    }

    getTaskStatus(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            return null;
        }

        return {
            id: task.id,
            status: task.status,
            lastRun: task.lastRun,
            nextRun: task.nextRun,
            runCount: task.runCount,
            successCount: task.successCount,
            failureCount: task.failureCount,
            isRunning: this.runningTasks.has(taskId)
        };
    }

    getAllTasks() {
        return Array.from(this.tasks.values()).map(task => ({
            id: task.id,
            status: task.status,
            priority: task.options.priority,
            tags: task.options.tags,
            lastRun: task.lastRun,
            runCount: task.runCount
        }));
    }

    getRunningTasks() {
        return Array.from(this.runningTasks).map(taskId => this.tasks.get(taskId));
    }

    getTaskHistory(taskId, limit = 20) {
        const history = this.taskHistory.get(taskId) || [];
        return history.slice(-limit);
    }

    getCompletedTasks(limit = 20) {
        return this.completedTasks.slice(-limit);
    }

    getFailedTasks(limit = 20) {
        return this.failedTasks.slice(-limit);
    }

    clearTaskHistory(taskId) {
        this.taskHistory.delete(taskId);
    }

    clearCompletedTasks() {
        this.completedTasks = [];
    }

    clearFailedTasks() {
        this.failedTasks = [];
    }

    setMaxConcurrency(max) {
        this.maxConcurrency = max;
    }

    getQueueLength() {
        return this.taskQueue.length;
    }

    getQueueContents() {
        return this.taskQueue.map(taskId => this.tasks.get(taskId));
    }

    exportTasks(format = 'json') {
        const tasks = Array.from(this.tasks.values());

        if (format === 'csv') {
            let csv = 'ID,Status,Priority,Tags,RunCount,SuccessCount,FailureCount,CreatedAt\n';
            for (const task of tasks) {
                csv += `"${task.id}","${task.status}","${task.options.priority}","${task.options.tags.join(';')}","${task.runCount}","${task.successCount}","${task.failureCount}","${task.createdAt}"\n`;
            }
            return csv;
        }

        return JSON.stringify(tasks, null, 2);
    }

    importTasks(tasksData, format = 'json') {
        let tasks;

        if (format === 'json' && typeof tasksData === 'string') {
            tasks = JSON.parse(tasksData);
        } else {
            tasks = tasksData;
        }

        for (const taskData of tasks) {
            this.scheduleTask(taskData.id, taskData.function, taskData.options);
        }

        return tasks.length;
    }

    generateExecutionId() {
        return `EXEC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getSchedulerStats() {
        const totalTasks = this.tasks.size;
        const runningTasks = this.runningTasks.size;
        const scheduledTasks = Array.from(this.tasks.values())
            .filter(task => task.status === 'scheduled').length;
        const pausedTasks = Array.from(this.tasks.values())
            .filter(task => task.status === 'paused').length;
        const completedTasks = this.completedTasks.length;
        const failedTasks = this.failedTasks.length;

        return {
            totalTasks,
            runningTasks,
            scheduledTasks,
            pausedTasks,
            queuedTasks: this.taskQueue.length,
            completedTasks,
            failedTasks,
            successRate: completedTasks + failedTasks > 0 ?
                (completedTasks / (completedTasks + failedTasks)) * 100 : 0
        };
    }

    stopAllTasks() {
        // Clear all intervals
        for (const [taskId, intervalId] of this.intervals.entries()) {
            clearInterval(intervalId);
        }
        this.intervals.clear();

        // Clear all timeouts
        for (const [executionId, timeoutId] of this.timeouts.entries()) {
            clearTimeout(timeoutId);
        }
        this.timeouts.clear();

        // Clear running tasks
        this.runningTasks.clear();
        this.taskQueue = [];
    }

    cleanup() {
        // Remove old completed/failed tasks (older than 7 days)
        const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        this.completedTasks = this.completedTasks.filter(task =>
            task.completedAt > cutoffDate
        );

        this.failedTasks = this.failedTasks.filter(task =>
            task.failedAt > cutoffDate
        );
    }
}

module.exports = TaskScheduler;
