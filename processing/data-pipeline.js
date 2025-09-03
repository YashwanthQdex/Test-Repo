const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class DataPipeline extends EventEmitter {
    constructor(options = {}) {
        super();
        this.stages = new Map();
        this.pipeline = [];
        this.dataStore = new Map();
        this.transformers = new Map();
        this.validators = new Map();
        this.filters = new Map();
        this.aggregators = new Map();
        this.metrics = {
            processedRecords: 0,
            failedRecords: 0,
            totalProcessingTime: 0,
            stageMetrics: new Map()
        };
        this.isRunning = false;
        this.maxConcurrency = options.maxConcurrency || 10;
        this.batchSize = options.batchSize || 100;
        this.retryAttempts = options.retryAttempts || 3;
        this.timeout = options.timeout || 30000;
        this.errorThreshold = options.errorThreshold || 0.1;
        this.checkpointInterval = options.checkpointInterval || 1000;
        this.checkpointData = new Map();
    }

    addStage(stageName, stageFunction, options = {}) {
        const stage = {
            name: stageName,
            function: stageFunction,
            options: {
                priority: options.priority || 0,
                dependencies: options.dependencies || [],
                timeout: options.timeout || this.timeout,
                retryAttempts: options.retryAttempts || this.retryAttempts,
                ...options
            },
            metrics: {
                executions: 0,
                failures: 0,
                totalTime: 0,
                lastExecution: null
            }
        };

        this.stages.set(stageName, stage);
        return this;
    }

    setPipeline(stages) {
        this.pipeline = stages;
        this.validatePipeline();
        return this;
    }

    validatePipeline() {
        const stageNames = new Set(this.stages.keys());

        for (const stageName of this.pipeline) {
            if (!stageNames.has(stageName)) {
                throw new Error(`Pipeline stage '${stageName}' not found`);
            }
        }

        // Check for circular dependencies
        this.checkCircularDependencies();
    }

    checkCircularDependencies() {
        const visited = new Set();
        const recursionStack = new Set();

        const checkStage = (stageName) => {
            if (recursionStack.has(stageName)) {
                throw new Error(`Circular dependency detected involving '${stageName}'`);
            }
            if (visited.has(stageName)) {
                return;
            }

            visited.add(stageName);
            recursionStack.add(stageName);

            const stage = this.stages.get(stageName);
            for (const dep of stage.options.dependencies) {
                checkStage(dep);
            }

            recursionStack.delete(stageName);
        };

        for (const stageName of this.pipeline) {
            if (!visited.has(stageName)) {
                checkStage(stageName);
            }
        }
    }

    async process(data, options = {}) {
        if (this.isRunning) {
            throw new Error('Pipeline is already running');
        }

        this.isRunning = true;
        this.metrics.processedRecords = 0;
        this.metrics.failedRecords = 0;
        this.metrics.totalProcessingTime = 0;

        const startTime = Date.now();
        const context = {
            data: Array.isArray(data) ? data : [data],
            metadata: options.metadata || {},
            errors: [],
            warnings: [],
            results: new Map(),
            stageResults: new Map()
        };

        try {
            this.emit('pipeline:start', context);

            for (const stageName of this.pipeline) {
                await this.processStage(stageName, context);
                this.checkpointIfNeeded(context);
            }

            this.emit('pipeline:complete', context);
            return context;

        } catch (error) {
            this.emit('pipeline:error', error, context);
            throw error;
        } finally {
            this.isRunning = false;
            this.metrics.totalProcessingTime = Date.now() - startTime;
        }
    }

    async processStage(stageName, context) {
        const stage = this.stages.get(stageName);
        if (!stage) {
            throw new Error(`Stage '${stageName}' not found`);
        }

        const stageStartTime = Date.now();
        stage.metrics.executions++;

        this.emit('stage:start', stageName, context);

        try {
            // Check dependencies
            await this.checkDependencies(stage, context);

            // Execute stage with timeout and retry logic
            const result = await this.executeWithRetry(stage, context);

            context.stageResults.set(stageName, result);
            stage.metrics.lastExecution = new Date();

            this.emit('stage:complete', stageName, result, context);

        } catch (error) {
            stage.metrics.failures++;
            context.errors.push({
                stage: stageName,
                error: error.message,
                timestamp: new Date()
            });

            this.emit('stage:error', stageName, error, context);

            if (!stage.options.continueOnError) {
                throw error;
            }
        } finally {
            stage.metrics.totalTime += Date.now() - stageStartTime;
        }
    }

    async checkDependencies(stage, context) {
        for (const dep of stage.options.dependencies) {
            if (!context.stageResults.has(dep)) {
                throw new Error(`Dependency '${dep}' not satisfied for stage '${stage.name}'`);
            }
        }
    }

    async executeWithRetry(stage, context) {
        let lastError;

        for (let attempt = 1; attempt <= stage.options.retryAttempts; attempt++) {
            try {
                const result = await this.executeWithTimeout(stage, context, attempt);
                return result;
            } catch (error) {
                lastError = error;

                if (attempt < stage.options.retryAttempts) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, delay));
                    this.emit('stage:retry', stage.name, attempt, error);
                }
            }
        }

        throw lastError;
    }

    async executeWithTimeout(stage, context, attempt) {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Stage '${stage.name}' timed out after ${stage.options.timeout}ms`));
            }, stage.options.timeout);

            try {
                const result = await stage.function(context, attempt);
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    checkpointIfNeeded(context) {
        if (this.metrics.processedRecords % this.checkpointInterval === 0) {
            this.createCheckpoint(context);
        }
    }

    createCheckpoint(context) {
        const checkpointId = `checkpoint_${Date.now()}`;
        this.checkpointData.set(checkpointId, {
            timestamp: new Date(),
            stageResults: new Map(context.stageResults),
            processedRecords: this.metrics.processedRecords,
            context: { ...context }
        });

        // Keep only last 10 checkpoints
        if (this.checkpointData.size > 10) {
            const oldestKey = this.checkpointData.keys().next().value;
            this.checkpointData.delete(oldestKey);
        }

        this.emit('checkpoint:created', checkpointId);
    }

    async processBatch(data, options = {}) {
        const batches = this.chunkArray(data, this.batchSize);
        const results = [];

        for (const batch of batches) {
            try {
                const result = await this.process(batch, options);
                results.push(result);
            } catch (error) {
                results.push({ error: error.message, batch: batch });
            }
        }

        return results;
    }

    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    addTransformer(name, transformer) {
        this.transformers.set(name, transformer);
        return this;
    }

    addValidator(name, validator) {
        this.validators.set(name, validator);
        return this;
    }

    addFilter(name, filter) {
        this.filters.set(name, filter);
        return this;
    }

    addAggregator(name, aggregator) {
        this.aggregators.set(name, aggregator);
        return this;
    }

    // Built-in stages
    createTransformStage(transformerName, inputField, outputField) {
        return async (context) => {
            const transformer = this.transformers.get(transformerName);
            if (!transformer) {
                throw new Error(`Transformer '${transformerName}' not found`);
            }

            const results = [];
            for (const record of context.data) {
                try {
                    const transformed = await transformer(record[inputField]);
                    record[outputField] = transformed;
                    results.push(record);
                } catch (error) {
                    context.errors.push({
                        record: record,
                        error: error.message,
                        transformer: transformerName
                    });
                }
            }

            context.data = results;
            return results;
        };
    }

    createValidationStage(validatorName, field) {
        return async (context) => {
            const validator = this.validators.get(validatorName);
            if (!validator) {
                throw new Error(`Validator '${validatorName}' not found`);
            }

            const validRecords = [];
            const invalidRecords = [];

            for (const record of context.data) {
                try {
                    const isValid = await validator(record[field]);
                    if (isValid) {
                        validRecords.push(record);
                    } else {
                        invalidRecords.push(record);
                    }
                } catch (error) {
                    context.errors.push({
                        record: record,
                        error: error.message,
                        validator: validatorName
                    });
                    invalidRecords.push(record);
                }
            }

            context.data = validRecords;
            context.invalidRecords = invalidRecords;
            return { valid: validRecords, invalid: invalidRecords };
        };
    }

    createFilterStage(filterName, field) {
        return async (context) => {
            const filter = this.filters.get(filterName);
            if (!filter) {
                throw new Error(`Filter '${filterName}' not found`);
            }

            const filteredRecords = [];
            for (const record of context.data) {
                try {
                    if (await filter(record[field])) {
                        filteredRecords.push(record);
                    }
                } catch (error) {
                    context.errors.push({
                        record: record,
                        error: error.message,
                        filter: filterName
                    });
                }
            }

            context.data = filteredRecords;
            return filteredRecords;
        };
    }

    createAggregationStage(aggregatorName, groupBy, aggregateFields) {
        return async (context) => {
            const aggregator = this.aggregators.get(aggregatorName);
            if (!aggregator) {
                throw new Error(`Aggregator '${aggregatorName}' not found`);
            }

            const groups = new Map();

            for (const record of context.data) {
                const key = record[groupBy];
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(record);
            }

            const aggregatedResults = [];
            for (const [groupKey, records] of groups.entries()) {
                try {
                    const aggregated = await aggregator(records, aggregateFields);
                    aggregated[groupBy] = groupKey;
                    aggregatedResults.push(aggregated);
                } catch (error) {
                    context.errors.push({
                        group: groupKey,
                        error: error.message,
                        aggregator: aggregatorName
                    });
                }
            }

            context.data = aggregatedResults;
            return aggregatedResults;
        };
    }

    // Data storage methods
    store(key, data) {
        this.dataStore.set(key, {
            data: data,
            timestamp: new Date(),
            size: JSON.stringify(data).length
        });
        return this;
    }

    retrieve(key) {
        const stored = this.dataStore.get(key);
        return stored ? stored.data : null;
    }

    delete(key) {
        return this.dataStore.delete(key);
    }

    listStoredData() {
        return Array.from(this.dataStore.entries()).map(([key, stored]) => ({
            key: key,
            timestamp: stored.timestamp,
            size: stored.size
        }));
    }

    // Metrics and monitoring
    getMetrics() {
        const stageMetrics = {};
        for (const [name, stage] of this.stages.entries()) {
            stageMetrics[name] = { ...stage.metrics };
        }

        return {
            ...this.metrics,
            stageMetrics: stageMetrics,
            pipelineLength: this.pipeline.length,
            isRunning: this.isRunning,
            dataStoreSize: this.dataStore.size,
            checkpointsCount: this.checkpointData.size
        };
    }

    resetMetrics() {
        this.metrics.processedRecords = 0;
        this.metrics.failedRecords = 0;
        this.metrics.totalProcessingTime = 0;

        for (const stage of this.stages.values()) {
            stage.metrics.executions = 0;
            stage.metrics.failures = 0;
            stage.metrics.totalTime = 0;
            stage.metrics.lastExecution = null;
        }
    }

    // Error handling
    getErrors() {
        return {
            totalErrors: this.metrics.failedRecords,
            errorThreshold: this.errorThreshold,
            isAboveThreshold: (this.metrics.failedRecords / this.metrics.processedRecords) > this.errorThreshold
        };
    }

    // Configuration
    setMaxConcurrency(max) {
        this.maxConcurrency = max;
        return this;
    }

    setBatchSize(size) {
        this.batchSize = size;
        return this;
    }

    setRetryAttempts(attempts) {
        this.retryAttempts = attempts;
        return this;
    }

    setTimeout(timeout) {
        this.timeout = timeout;
        return this;
    }

    setErrorThreshold(threshold) {
        this.errorThreshold = threshold;
        return this;
    }

    // Export/Import
    exportPipeline() {
        return {
            stages: Array.from(this.stages.entries()),
            pipeline: this.pipeline,
            transformers: Array.from(this.transformers.entries()),
            validators: Array.from(this.validators.entries()),
            filters: Array.from(this.filters.entries()),
            aggregators: Array.from(this.aggregators.entries()),
            config: {
                maxConcurrency: this.maxConcurrency,
                batchSize: this.batchSize,
                retryAttempts: this.retryAttempts,
                timeout: this.timeout,
                errorThreshold: this.errorThreshold
            }
        };
    }

    importPipeline(exportedData) {
        this.stages.clear();
        this.pipeline = exportedData.pipeline || [];
        this.transformers.clear();
        this.validators.clear();
        this.filters.clear();
        this.aggregators.clear();

        for (const [name, stage] of exportedData.stages) {
            this.stages.set(name, stage);
        }

        for (const [name, transformer] of exportedData.transformers) {
            this.transformers.set(name, transformer);
        }

        for (const [name, validator] of exportedData.validators) {
            this.validators.set(name, validator);
        }

        for (const [name, filter] of exportedData.filters) {
            this.filters.set(name, filter);
        }

        for (const [name, aggregator] of exportedData.aggregators) {
            this.aggregators.set(name, aggregator);
        }

        const config = exportedData.config || {};
        this.maxConcurrency = config.maxConcurrency || 10;
        this.batchSize = config.batchSize || 100;
        this.retryAttempts = config.retryAttempts || 3;
        this.timeout = config.timeout || 30000;
        this.errorThreshold = config.errorThreshold || 0.1;

        return this;
    }

    // Utility methods
    createDataSource(filePath, format = 'json') {
        return {
            name: `file_${path.basename(filePath)}`,
            type: 'file',
            path: filePath,
            format: format,
            load: async () => {
                const data = fs.readFileSync(filePath, 'utf8');
                if (format === 'json') {
                    return JSON.parse(data);
                }
                return data;
            }
        };
    }

    createDataSink(filePath, format = 'json') {
        return {
            name: `file_${path.basename(filePath)}`,
            type: 'file',
            path: filePath,
            format: format,
            save: async (data) => {
                const content = format === 'json' ? JSON.stringify(data, null, 2) : data;
                fs.writeFileSync(filePath, content);
            }
        };
    }

    createDatabaseSource(tableName, connection) {
        return {
            name: `db_${tableName}`,
            type: 'database',
            table: tableName,
            connection: connection,
            load: async (query = `SELECT * FROM ${tableName}`) => {
                // Mock database query
                return [];
            }
        };
    }

    createDatabaseSink(tableName, connection) {
        return {
            name: `db_${tableName}`,
            type: 'database',
            table: tableName,
            connection: connection,
            save: async (data) => {
                // Mock database insert
                console.log(`Saving ${data.length} records to ${tableName}`);
            }
        };
    }

    createHTTPDataSource(url, headers = {}) {
        return {
            name: `http_${url}`,
            type: 'http',
            url: url,
            headers: headers,
            load: async () => {
                const fetch = require('node-fetch');
                const response = await fetch(url, { headers });
                return await response.json();
            }
        };
    }

    createHTTPDataSink(url, headers = {}) {
        return {
            name: `http_${url}`,
            type: 'http',
            url: url,
            headers: headers,
            save: async (data) => {
                const fetch = require('node-fetch');
                await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...headers
                    },
                    body: JSON.stringify(data)
                });
            }
        };
    }

    // Advanced features
    createConditionalStage(condition, trueStage, falseStage) {
        return async (context) => {
            const result = await condition(context);
            const nextStage = result ? trueStage : falseStage;
            return await this.stages.get(nextStage).function(context);
        };
    }

    createParallelStage(stages) {
        return async (context) => {
            const promises = stages.map(stageName => {
                const stage = this.stages.get(stageName);
                return stage.function(context);
            });

            return await Promise.all(promises);
        };
    }

    createSequentialStage(stages) {
        return async (context) => {
            const results = [];
            for (const stageName of stages) {
                const stage = this.stages.get(stageName);
                const result = await stage.function(context);
                results.push(result);
            }
            return results;
        };
    }

    createLoopStage(stageName, condition) {
        return async (context) => {
            const results = [];
            let iteration = 0;
            const maxIterations = 100; // Prevent infinite loops

            while (await condition(context) && iteration < maxIterations) {
                const stage = this.stages.get(stageName);
                const result = await stage.function(context);
                results.push(result);
                iteration++;
            }

            if (iteration >= maxIterations) {
                throw new Error(`Loop stage exceeded maximum iterations (${maxIterations})`);
            }

            return results;
        };
    }

    // Monitoring and logging
    enableDetailedLogging() {
        this.on('pipeline:start', (context) => {
            console.log(`Pipeline started with ${context.data.length} records`);
        });

        this.on('stage:start', (stageName, context) => {
            console.log(`Stage '${stageName}' started`);
        });

        this.on('stage:complete', (stageName, result, context) => {
            console.log(`Stage '${stageName}' completed`);
        });

        this.on('stage:error', (stageName, error, context) => {
            console.error(`Stage '${stageName}' failed:`, error.message);
        });

        this.on('pipeline:complete', (context) => {
            console.log(`Pipeline completed. Processed: ${context.data.length}, Errors: ${context.errors.length}`);
        });

        return this;
    }

    createProgressReporter() {
        const totalStages = this.pipeline.length;
        let completedStages = 0;

        this.on('stage:complete', (stageName) => {
            completedStages++;
            const progress = (completedStages / totalStages) * 100;
            console.log(`Pipeline progress: ${progress.toFixed(1)}% (${completedStages}/${totalStages} stages)`);
        });

        this.on('pipeline:complete', () => {
            completedStages = 0;
        });

        return this;
    }

    // Error recovery
    createRecoveryPoint(stageName) {
        return async (context) => {
            const checkpointId = `recovery_${stageName}_${Date.now()}`;
            this.checkpointData.set(checkpointId, {
                stage: stageName,
                context: { ...context },
                timestamp: new Date()
            });

            const stage = this.stages.get(stageName);
            const result = await stage.function(context);

            // Remove checkpoint on success
            this.checkpointData.delete(checkpointId);
            return result;
        };
    }

    recoverFromCheckpoint(checkpointId) {
        const checkpoint = this.checkpointData.get(checkpointId);
        if (!checkpoint) {
            throw new Error(`Checkpoint '${checkpointId}' not found`);
        }

        return checkpoint.context;
    }

    // Performance optimization
    createCachedStage(stageName, cacheKey, ttl = 300000) {
        return async (context) => {
            const cacheKeyValue = typeof cacheKey === 'function' ? cacheKey(context) : cacheKey;
            const cached = this.retrieve(cacheKeyValue);

            if (cached && Date.now() - cached.timestamp < ttl) {
                return cached.data;
            }

            const stage = this.stages.get(stageName);
            const result = await stage.function(context);

            this.store(cacheKeyValue, result);
            return result;
        };
    }

    // Data quality checks
    createDataQualityStage(checks) {
        return async (context) => {
            const qualityReport = {
                totalRecords: context.data.length,
                checks: {},
                passed: 0,
                failed: 0
            };

            for (const [checkName, checkFunction] of Object.entries(checks)) {
                try {
                    const result = await checkFunction(context.data);
                    qualityReport.checks[checkName] = result;

                    if (result.passed) {
                        qualityReport.passed++;
                    } else {
                        qualityReport.failed++;
                    }
                } catch (error) {
                    qualityReport.checks[checkName] = { passed: false, error: error.message };
                    qualityReport.failed++;
                }
            }

            context.qualityReport = qualityReport;
            return qualityReport;
        };
    }

    // Integration with external systems
    createWebhookStage(url, eventType) {
        return async (context) => {
            const fetch = require('node-fetch');

            const payload = {
                event: eventType,
                timestamp: new Date(),
                data: context.data,
                metadata: context.metadata
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        };
    }

    createEmailNotificationStage(emailService, recipients, template) {
        return async (context) => {
            const notificationData = {
                recipients: recipients,
                subject: template.subject,
                content: template.content,
                data: {
                    processedRecords: context.data.length,
                    errors: context.errors.length,
                    processingTime: this.metrics.totalProcessingTime
                }
            };

            return await emailService.sendTemplateEmail(
                recipients[0],
                template.name,
                notificationData.data
            );
        };
    }

    // Advanced data processing
    createMLStage(modelPath, inputField, outputField) {
        return async (context) => {
            // Mock ML processing
            for (const record of context.data) {
                record[outputField] = Math.random() > 0.5 ? 'positive' : 'negative';
            }
            return context.data;
        };
    }

    createGeospatialStage(operation, inputField, outputField) {
        return async (context) => {
            // Mock geospatial processing
            for (const record of context.data) {
                record[outputField] = {
                    latitude: (Math.random() - 0.5) * 180,
                    longitude: (Math.random() - 0.5) * 360,
                    accuracy: Math.random() * 100
                };
            }
            return context.data;
        };
    }

    createTimeSeriesStage(operation, timeField, valueField) {
        return async (context) => {
            const timeSeries = new Map();

            for (const record of context.data) {
                const time = record[timeField];
                const value = record[valueField];

                if (!timeSeries.has(time)) {
                    timeSeries.set(time, []);
                }
                timeSeries.get(time).push(value);
            }

            const results = [];
            for (const [time, values] of timeSeries.entries()) {
                let result;
                switch (operation) {
                    case 'sum':
                        result = values.reduce((sum, val) => sum + val, 0);
                        break;
                    case 'avg':
                        result = values.reduce((sum, val) => sum + val, 0) / values.length;
                        break;
                    case 'max':
                        result = Math.max(...values);
                        break;
                    case 'min':
                        result = Math.min(...values);
                        break;
                    default:
                        result = values;
                }

                results.push({
                    time: time,
                    value: result,
                    count: values.length
                });
            }

            context.data = results;
            return results;
        };
    }

    // Real-time processing
    enableRealTimeProcessing() {
        this.realTimeEnabled = true;
        return this;
    }

    processRealTime(data, callback) {
        if (!this.realTimeEnabled) {
            throw new Error('Real-time processing not enabled');
        }

        // Process data immediately
        this.process(data)
            .then(result => callback(null, result))
            .catch(error => callback(error, null));
    }

    // Streaming data support
    createStreamingStage(streamProcessor) {
        return async (context) => {
            const results = [];
            const stream = this.createDataStream(context.data);

            return new Promise((resolve, reject) => {
                stream.on('data', async (chunk) => {
                    try {
                        const processed = await streamProcessor(chunk);
                        results.push(processed);
                    } catch (error) {
                        context.errors.push({
                            chunk: chunk,
                            error: error.message
                        });
                    }
                });

                stream.on('end', () => resolve(results));
                stream.on('error', reject);
            });
        };
    }

    createDataStream(data) {
        const { Readable } = require('stream');

        const stream = new Readable({
            objectMode: true,
            read() {
                if (data.length === 0) {
                    this.push(null);
                    return;
                }

                const chunk = data.splice(0, this.batchSize);
                this.push(chunk);
            }
        });

        return stream;
    }

    // Advanced error handling
    createErrorHandlingStage(errorHandler) {
        return async (context) => {
            const originalErrors = [...context.errors];
            context.errors = [];

            try {
                return await errorHandler(context, originalErrors);
            } catch (error) {
                context.errors.push({
                    stage: 'error_handler',
                    error: error.message
                });
                throw error;
            }
        };
    }

    createRetryStage(failedStage, maxRetries = 3) {
        return async (context) => {
            const errors = context.errors.filter(e => e.stage === failedStage);
            const results = [];

            for (const error of errors) {
                let attempt = 0;
                let success = false;

                while (attempt < maxRetries && !success) {
                    try {
                        // Retry logic would go here
                        const result = await this.stages.get(failedStage).function({
                            data: [error.record],
                            errors: [],
                            metadata: context.metadata
                        });
                        results.push(result);
                        success = true;
                    } catch (retryError) {
                        attempt++;
                        if (attempt >= maxRetries) {
                            context.errors.push({
                                stage: failedStage,
                                error: retryError.message,
                                originalError: error.error,
                                attempts: attempt
                            });
                        }
                    }
                }
            }

            return results;
        };
    }

    // Performance monitoring
    createPerformanceStage() {
        return async (context) => {
            const performance = {
                startTime: Date.now(),
                recordsProcessed: context.data.length,
                errorsCount: context.errors.length,
                memoryUsage: process.memoryUsage(),
                stageMetrics: {}
            };

            for (const [stageName, stage] of this.stages.entries()) {
                performance.stageMetrics[stageName] = { ...stage.metrics };
            }

            context.performance = performance;
            return performance;
        };
    }

    // Data lineage tracking
    createLineageStage() {
        return async (context) => {
            const lineage = {
                pipelineId: `pipeline_${Date.now()}`,
                stages: [],
                dataFlow: [],
                transformations: [],
                timestamp: new Date()
            };

            for (const stageName of this.pipeline) {
                const stage = this.stages.get(stageName);
                lineage.stages.push({
                    name: stageName,
                    type: stage.options.type || 'processing',
                    dependencies: stage.options.dependencies,
                    metrics: { ...stage.metrics }
                });
            }

            context.lineage = lineage;
            return lineage;
        };
    }

    // Compliance and auditing
    createAuditStage(auditLogger) {
        return async (context) => {
            const auditEntry = {
                pipelineId: `pipeline_${Date.now()}`,
                timestamp: new Date(),
                user: context.metadata.user || 'system',
                operation: 'pipeline_execution',
                recordsProcessed: context.data.length,
                errorsCount: context.errors.length,
                stagesExecuted: this.pipeline.length,
                metadata: context.metadata
            };

            if (auditLogger) {
                await auditLogger.log(auditEntry);
            }

            context.auditEntry = auditEntry;
            return auditEntry;
        };
    }

    // Multi-tenant support
    createTenantStage(tenantId) {
        return async (context) => {
            context.metadata.tenantId = tenantId;

            // Filter data by tenant
            if (context.data && context.data.length > 0) {
                context.data = context.data.filter(record =>
                    record.tenantId === tenantId || !record.tenantId
                );
            }

            return context.data;
        };
    }

    // Version control for pipelines
    createVersionControl() {
        this.versions = new Map();
        this.currentVersion = null;

        return {
            saveVersion: (versionName, description = '') => {
                const version = {
                    name: versionName,
                    description: description,
                    timestamp: new Date(),
                    pipeline: [...this.pipeline],
                    stages: new Map(this.stages),
                    config: {
                        maxConcurrency: this.maxConcurrency,
                        batchSize: this.batchSize,
                        retryAttempts: this.retryAttempts,
                        timeout: this.timeout
                    }
                };

                this.versions.set(versionName, version);
                this.currentVersion = versionName;
                return version;
            },

            loadVersion: (versionName) => {
                const version = this.versions.get(versionName);
                if (!version) {
                    throw new Error(`Version '${versionName}' not found`);
                }

                this.pipeline = [...version.pipeline];
                this.stages = new Map(version.stages);
                const config = version.config;
                this.maxConcurrency = config.maxConcurrency;
                this.batchSize = config.batchSize;
                this.retryAttempts = config.retryAttempts;
                this.timeout = config.timeout;
                this.currentVersion = versionName;

                return version;
            },

            listVersions: () => {
                return Array.from(this.versions.entries()).map(([name, version]) => ({
                    name: name,
                    description: version.description,
                    timestamp: version.timestamp
                }));
            },

            diffVersions: (version1, version2) => {
                const v1 = this.versions.get(version1);
                const v2 = this.versions.get(version2);

                if (!v1 || !v2) {
                    throw new Error('Version not found');
                }

                return {
                    pipelineChanges: this.compareArrays(v1.pipeline, v2.pipeline),
                    stageChanges: this.compareMaps(v1.stages, v2.stages),
                    configChanges: this.compareObjects(v1.config, v2.config)
                };
            }
        };
    }

    compareArrays(arr1, arr2) {
        const added = arr2.filter(item => !arr1.includes(item));
        const removed = arr1.filter(item => !arr2.includes(item));
        return { added, removed };
    }

    compareMaps(map1, map2) {
        const changes = { added: [], modified: [], removed: [] };

        for (const [key, value] of map2.entries()) {
            if (!map1.has(key)) {
                changes.added.push(key);
            } else if (JSON.stringify(map1.get(key)) !== JSON.stringify(value)) {
                changes.modified.push(key);
            }
        }

        for (const key of map1.keys()) {
            if (!map2.has(key)) {
                changes.removed.push(key);
            }
        }

        return changes;
    }

    compareObjects(obj1, obj2) {
        const changes = {};

        const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

        for (const key of allKeys) {
            if (!(key in obj1)) {
                changes[key] = { type: 'added', value: obj2[key] };
            } else if (!(key in obj2)) {
                changes[key] = { type: 'removed', value: obj1[key] };
            } else if (obj1[key] !== obj2[key]) {
                changes[key] = { type: 'modified', oldValue: obj1[key], newValue: obj2[key] };
            }
        }

        return changes;
    }

    // Plugin system
    createPluginSystem() {
        this.plugins = new Map();

        return {
            registerPlugin: (name, plugin) => {
                this.plugins.set(name, plugin);
                if (plugin.init) {
                    plugin.init(this);
                }
            },

            unregisterPlugin: (name) => {
                const plugin = this.plugins.get(name);
                if (plugin && plugin.destroy) {
                    plugin.destroy(this);
                }
                this.plugins.delete(name);
            },

            getPlugin: (name) => {
                return this.plugins.get(name);
            },

            listPlugins: () => {
                return Array.from(this.plugins.keys());
            },

            executePluginHook: async (hookName, ...args) => {
                const results = [];
                for (const plugin of this.plugins.values()) {
                    if (plugin[hookName]) {
                        try {
                            const result = await plugin[hookName](...args);
                            results.push(result);
                        } catch (error) {
                            console.error(`Plugin hook '${hookName}' failed:`, error.message);
                        }
                    }
                }
                return results;
            }
        };
    }

    // Resource management
    createResourceManager() {
        this.resources = new Map();
        this.resourceUsage = new Map();

        return {
            registerResource: (name, resource) => {
                this.resources.set(name, resource);
                this.resourceUsage.set(name, {
                    inUse: false,
                    lastUsed: null,
                    usageCount: 0,
                    errors: 0
                });
            },

            acquireResource: async (name) => {
                const resource = this.resources.get(name);
                const usage = this.resourceUsage.get(name);

                if (!resource) {
                    throw new Error(`Resource '${name}' not found`);
                }

                if (usage.inUse) {
                    throw new Error(`Resource '${name}' is already in use`);
                }

                usage.inUse = true;
                usage.lastUsed = new Date();
                usage.usageCount++;

                return resource;
            },

            releaseResource: (name) => {
                const usage = this.resourceUsage.get(name);
                if (usage) {
                    usage.inUse = false;
                }
            },

            getResourceStats: () => {
                return Array.from(this.resourceUsage.entries()).map(([name, usage]) => ({
                    name: name,
                    ...usage
                }));
            }
        };
    }

    // Health monitoring
    createHealthMonitor() {
        this.healthChecks = new Map();

        return {
            addHealthCheck: (name, checkFunction) => {
                this.healthChecks.set(name, checkFunction);
            },

            runHealthChecks: async () => {
                const results = {};

                for (const [name, checkFunction] of this.healthChecks.entries()) {
                    try {
                        const result = await checkFunction();
                        results[name] = {
                            status: 'healthy',
                            result: result,
                            timestamp: new Date()
                        };
                    } catch (error) {
                        results[name] = {
                            status: 'unhealthy',
                            error: error.message,
                            timestamp: new Date()
                        };
                    }
                }

                return results;
            },

            getOverallHealth: async () => {
                const results = await this.runHealthChecks();
                const unhealthy = Object.values(results).filter(r => r.status === 'unhealthy');

                return {
                    status: unhealthy.length === 0 ? 'healthy' : 'unhealthy',
                    totalChecks: Object.keys(results).length,
                    healthyChecks: Object.keys(results).length - unhealthy.length,
                    unhealthyChecks: unhealthy.length,
                    details: results
                };
            }
        };
    }

    // Backup and recovery
    createBackupManager() {
        this.backups = new Map();

        return {
            createBackup: (name, description = '') => {
                const backup = {
                    name: name,
                    description: description,
                    timestamp: new Date(),
                    pipeline: [...this.pipeline],
                    stages: new Map(this.stages),
                    transformers: new Map(this.transformers),
                    validators: new Map(this.validators),
                    filters: new Map(this.filters),
                    aggregators: new Map(this.aggregators),
                    config: {
                        maxConcurrency: this.maxConcurrency,
                        batchSize: this.batchSize,
                        retryAttempts: this.retryAttempts,
                        timeout: this.timeout,
                        errorThreshold: this.errorThreshold
                    },
                    metrics: { ...this.metrics },
                    dataStore: new Map(this.dataStore)
                };

                this.backups.set(name, backup);
                return backup;
            },

            restoreFromBackup: (name) => {
                const backup = this.backups.get(name);
                if (!backup) {
                    throw new Error(`Backup '${name}' not found`);
                }

                this.pipeline = [...backup.pipeline];
                this.stages = new Map(backup.stages);
                this.transformers = new Map(backup.transformers);
                this.validators = new Map(backup.validators);
                this.filters = new Map(backup.filters);
                this.aggregators = new Map(backup.aggregators);

                const config = backup.config;
                this.maxConcurrency = config.maxConcurrency;
                this.batchSize = config.batchSize;
                this.retryAttempts = config.retryAttempts;
                this.timeout = config.timeout;
                this.errorThreshold = config.errorThreshold;

                this.metrics = { ...backup.metrics };
                this.dataStore = new Map(backup.dataStore);

                return backup;
            },

            listBackups: () => {
                return Array.from(this.backups.entries()).map(([name, backup]) => ({
                    name: name,
                    description: backup.description,
                    timestamp: backup.timestamp
                }));
            },

            deleteBackup: (name) => {
                return this.backups.delete(name);
            }
        };
    }

    // Advanced analytics
    createAnalyticsEngine() {
        this.analytics = {
            performanceMetrics: [],
            errorPatterns: new Map(),
            dataQualityMetrics: [],
            throughputMetrics: []
        };

        return {
            recordPerformanceMetric: (stageName, duration, recordCount) => {
                this.analytics.performanceMetrics.push({
                    stageName: stageName,
                    duration: duration,
                    recordCount: recordCount,
                    throughput: recordCount / (duration / 1000), // records per second
                    timestamp: new Date()
                });
            },

            recordError: (stageName, errorType, errorMessage) => {
                const key = `${stageName}:${errorType}`;
                const current = this.analytics.errorPatterns.get(key) || 0;
                this.analytics.errorPatterns.set(key, current + 1);
            },

            recordDataQuality: (checkName, passed, failed) => {
                this.analytics.dataQualityMetrics.push({
                    checkName: checkName,
                    passed: passed,
                    failed: failed,
                    qualityScore: passed / (passed + failed),
                    timestamp: new Date()
                });
            },

            getPerformanceAnalytics: (timeRange = 3600000) => {
                const cutoff = Date.now() - timeRange;
                const recentMetrics = this.analytics.performanceMetrics
                    .filter(m => m.timestamp.getTime() > cutoff);

                const stageStats = {};
                for (const metric of recentMetrics) {
                    if (!stageStats[metric.stageName]) {
                        stageStats[metric.stageName] = {
                            totalDuration: 0,
                            totalRecords: 0,
                            executions: 0,
                            avgThroughput: 0
                        };
                    }

                    const stats = stageStats[metric.stageName];
                    stats.totalDuration += metric.duration;
                    stats.totalRecords += metric.recordCount;
                    stats.executions++;
                    stats.avgThroughput = stats.totalRecords / (stats.totalDuration / 1000);
                }

                return stageStats;
            },

            getErrorAnalytics: () => {
                return Object.fromEntries(this.analytics.errorPatterns.entries());
            },

            getDataQualityAnalytics: (timeRange = 3600000) => {
                const cutoff = Date.now() - timeRange;
                const recentMetrics = this.analytics.dataQualityMetrics
                    .filter(m => m.timestamp.getTime() > cutoff);

                const qualityStats = {};
                for (const metric of recentMetrics) {
                    if (!qualityStats[metric.checkName]) {
                        qualityStats[metric.checkName] = {
                            totalPassed: 0,
                            totalFailed: 0,
                            avgQualityScore: 0,
                            checks: 0
                        };
                    }

                    const stats = qualityStats[metric.checkName];
                    stats.totalPassed += metric.passed;
                    stats.totalFailed += metric.failed;
                    stats.checks++;
                    stats.avgQualityScore = (stats.totalPassed / (stats.totalPassed + stats.totalFailed));
                }

                return qualityStats;
            },

            generateReport: () => {
                return {
                    performance: this.getPerformanceAnalytics(),
                    errors: this.getErrorAnalytics(),
                    dataQuality: this.getDataQualityAnalytics(),
                    overall: {
                        totalStages: this.stages.size,
                        totalPipelineRuns: this.metrics.processedRecords,
                        errorRate: this.metrics.failedRecords / this.metrics.processedRecords || 0,
                        avgProcessingTime: this.metrics.totalProcessingTime / this.metrics.processedRecords || 0
                    }
                };
            }
        };
    }

    // Distributed processing support
    createDistributedCoordinator() {
        this.workers = new Map();
        this.taskDistribution = new Map();

        return {
            addWorker: (workerId, workerInfo) => {
                this.workers.set(workerId, {
                    id: workerId,
                    ...workerInfo,
                    status: 'idle',
                    lastHeartbeat: new Date(),
                    currentTask: null
                });
            },

            removeWorker: (workerId) => {
                const worker = this.workers.get(workerId);
                if (worker && worker.currentTask) {
                    // Reassign task
                    this.reassignTask(worker.currentTask);
                }
                this.workers.delete(workerId);
            },

            assignTask: (taskId, workerId) => {
                const worker = this.workers.get(workerId);
                if (!worker) {
                    throw new Error(`Worker '${workerId}' not found`);
                }

                if (worker.status !== 'idle') {
                    throw new Error(`Worker '${workerId}' is not available`);
                }

                worker.status = 'busy';
                worker.currentTask = taskId;
                this.taskDistribution.set(taskId, workerId);
            },

            completeTask: (taskId, result) => {
                const workerId = this.taskDistribution.get(taskId);
                if (workerId) {
                    const worker = this.workers.get(workerId);
                    if (worker) {
                        worker.status = 'idle';
                        worker.currentTask = null;
                        worker.lastHeartbeat = new Date();
                    }
                    this.taskDistribution.delete(taskId);
                }
                return result;
            },

            getWorkerStats: () => {
                const stats = {};
                for (const worker of this.workers.values()) {
                    stats[worker.id] = {
                        status: worker.status,
                        currentTask: worker.currentTask,
                        lastHeartbeat: worker.lastHeartbeat
                    };
                }
                return stats;
            },

            reassignTask: (taskId) => {
                const availableWorker = Array.from(this.workers.values())
                    .find(worker => worker.status === 'idle');

                if (availableWorker) {
                    this.assignTask(taskId, availableWorker.id);
                    return availableWorker.id;
                }

                return null;
            }
        };
    }

    // Final utility methods
    toJSON() {
        return {
            pipeline: this.pipeline,
            stages: Array.from(this.stages.entries()),
            config: {
                maxConcurrency: this.maxConcurrency,
                batchSize: this.batchSize,
                retryAttempts: this.retryAttempts,
                timeout: this.timeout,
                errorThreshold: this.errorThreshold
            },
            metrics: this.metrics
        };
    }

    static fromJSON(data) {
        const pipeline = new DataPipeline(data.config);
        pipeline.pipeline = data.pipeline;
        pipeline.stages = new Map(data.stages);
        pipeline.metrics = data.metrics;
        return pipeline;
    }

    destroy() {
        this.stages.clear();
        this.pipeline = [];
        this.dataStore.clear();
        this.transformers.clear();
        this.validators.clear();
        this.filters.clear();
        this.aggregators.clear();
        this.checkpointData.clear();
        this.removeAllListeners();
    }
}

module.exports = DataPipeline;
