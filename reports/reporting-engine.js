const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class ReportingEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        this.reports = new Map();
        this.templates = new Map();
        this.dataSources = new Map();
        this.scheduledReports = new Map();
        this.reportHistory = [];
        this.exportFormats = new Map();
        this.cache = new Map();
        this.permissions = new Map();
        this.auditLog = [];
        this.metrics = {
            totalReports: 0,
            successfulGenerations: 0,
            failedGenerations: 0,
            totalExports: 0,
            averageGenerationTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };

        this.cacheEnabled = options.cacheEnabled || true;
        this.cacheTTL = options.cacheTTL || 3600000; // 1 hour
        this.maxConcurrency = options.maxConcurrency || 5;
        this.timeout = options.timeout || 300000;
        this.enableAudit = options.enableAudit || true;
        this.defaultFormat = options.defaultFormat || 'pdf';
        this.storagePath = options.storagePath || './reports';
    }

    // Report Template Management
    createTemplate(templateId, templateData) {
        const template = {
            id: templateId,
            name: templateData.name,
            description: templateData.description,
            category: templateData.category || 'general',
            type: templateData.type || 'standard', // standard, dashboard, analytical
            layout: templateData.layout,
            dataSources: templateData.dataSources || [],
            parameters: templateData.parameters || [],
            filters: templateData.filters || [],
            calculations: templateData.calculations || [],
            visualizations: templateData.visualizations || [],
            styling: templateData.styling || {},
            permissions: templateData.permissions || [],
            createdAt: new Date(),
            lastModified: new Date(),
            version: 1,
            usageCount: 0
        };

        this.templates.set(templateId, template);
        this.audit('template_created', { templateId, userId: templateData.createdBy });
        return template;
    }

    updateTemplate(templateId, updates) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template '${templateId}' not found`);
        }

        Object.assign(template, updates);
        template.lastModified = new Date();
        template.version++;

        this.audit('template_updated', { templateId, version: template.version });
        return template;
    }

    deleteTemplate(templateId) {
        const template = this.templates.get(templateId);
        if (!template) {
            return false;
        }

        this.templates.delete(templateId);
        this.audit('template_deleted', { templateId });
        return true;
    }

    getTemplate(templateId) {
        return this.templates.get(templateId);
    }

    listTemplates(category = null) {
        let templates = Array.from(this.templates.values());

        if (category) {
            templates = templates.filter(template => template.category === category);
        }

        return templates.map(template => ({
            id: template.id,
            name: template.name,
            category: template.category,
            type: template.type,
            version: template.version,
            usageCount: template.usageCount
        }));
    }

    // Data Source Management
    registerDataSource(sourceId, sourceConfig) {
        const dataSource = {
            id: sourceId,
            name: sourceConfig.name,
            type: sourceConfig.type, // database, api, file, stream
            config: sourceConfig.config,
            schema: sourceConfig.schema || {},
            enabled: sourceConfig.enabled !== false,
            cacheEnabled: sourceConfig.cacheEnabled !== false,
            refreshInterval: sourceConfig.refreshInterval,
            lastRefresh: null,
            connectionStatus: 'disconnected',
            createdAt: new Date()
        };

        this.dataSources.set(sourceId, dataSource);
        return dataSource;
    }

    async connectDataSource(sourceId) {
        const dataSource = this.dataSources.get(sourceId);
        if (!dataSource) {
            throw new Error(`Data source '${sourceId}' not found`);
        }

        try {
            // Mock connection logic
            await new Promise(resolve => setTimeout(resolve, 100));
            dataSource.connectionStatus = 'connected';
            dataSource.lastRefresh = new Date();

            this.emit('datasource:connected', sourceId);
            return true;
        } catch (error) {
            dataSource.connectionStatus = 'error';
            this.emit('datasource:error', sourceId, error);
            throw error;
        }
    }

    async queryDataSource(sourceId, query, parameters = {}) {
        const dataSource = this.dataSources.get(sourceId);
        if (!dataSource) {
            throw new Error(`Data source '${sourceId}' not found`);
        }

        if (dataSource.connectionStatus !== 'connected') {
            await this.connectDataSource(sourceId);
        }

        // Check cache first
        const cacheKey = `${sourceId}:${JSON.stringify(query)}:${JSON.stringify(parameters)}`;
        if (this.cacheEnabled && dataSource.cacheEnabled) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                this.metrics.cacheHits++;
                return cached;
            }
            this.metrics.cacheMisses++;
        }

        try {
            let result;

            switch (dataSource.type) {
                case 'database':
                    result = await this.queryDatabase(dataSource, query, parameters);
                    break;
                case 'api':
                    result = await this.queryAPI(dataSource, query, parameters);
                    break;
                case 'file':
                    result = await this.queryFile(dataSource, query, parameters);
                    break;
                default:
                    throw new Error(`Unsupported data source type: ${dataSource.type}`);
            }

            // Cache the result
            if (this.cacheEnabled && dataSource.cacheEnabled) {
                this.setCache(cacheKey, result, dataSource.refreshInterval);
            }

            dataSource.lastRefresh = new Date();
            return result;

        } catch (error) {
            this.emit('datasource:query_error', sourceId, error);
            throw error;
        }
    }

    async queryDatabase(dataSource, query, parameters) {
        // Mock database query
        await new Promise(resolve => setTimeout(resolve, 50));

        // Simulate different query results based on query type
        if (query.includes('COUNT')) {
            return [{ count: Math.floor(Math.random() * 1000) }];
        } else if (query.includes('SUM')) {
            return [{ total: Math.random() * 10000 }];
        } else {
            const rows = [];
            for (let i = 0; i < 10; i++) {
                rows.push({
                    id: i + 1,
                    name: `Item ${i + 1}`,
                    value: Math.random() * 100,
                    created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
                });
            }
            return rows;
        }
    }

    async queryAPI(dataSource, query, parameters) {
        const fetch = require('node-fetch');

        const url = `${dataSource.config.baseUrl}${query}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${dataSource.config.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`API query failed: ${response.status}`);
        }

        return await response.json();
    }

    async queryFile(dataSource, query, parameters) {
        // Mock file reading
        const filePath = dataSource.config.filePath;
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf8');

        if (dataSource.config.format === 'json') {
            return JSON.parse(content);
        } else {
            // Parse CSV-like data
            const lines = content.split('\n');
            const headers = lines[0].split(',');
            const rows = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                const row = {};
                headers.forEach((header, index) => {
                    row[header.trim()] = values[index]?.trim();
                });
                rows.push(row);
            }

            return rows;
        }
    }

    // Report Generation
    async generateReport(templateId, parameters = {}, options = {}) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template '${templateId}' not found`);
        }

        const reportId = this.generateReportId();
        const report = {
            id: reportId,
            templateId: templateId,
            parameters: parameters,
            status: 'generating',
            createdAt: new Date(),
            generatedAt: null,
            data: null,
            errors: [],
            metadata: {
                userId: options.userId,
                format: options.format || this.defaultFormat,
                filters: options.filters || {}
            }
        };

        this.reports.set(reportId, report);
        this.metrics.totalReports++;

        try {
            this.emit('report:started', report);

            // Gather data from all data sources
            const data = await this.gatherReportData(template, parameters);

            // Apply calculations
            const calculatedData = await this.applyCalculations(template, data);

            // Apply filters
            const filteredData = this.applyFilters(template, calculatedData, parameters);

            // Generate visualizations
            const visualizations = await this.generateVisualizations(template, filteredData);

            report.data = {
                raw: data,
                calculated: calculatedData,
                filtered: filteredData,
                visualizations: visualizations
            };

            report.status = 'completed';
            report.generatedAt = new Date();

            template.usageCount++;
            this.metrics.successfulGenerations++;

            this.emit('report:completed', report);
            return report;

        } catch (error) {
            report.status = 'failed';
            report.errors.push({
                message: error.message,
                timestamp: new Date(),
                stack: error.stack
            });

            this.metrics.failedGenerations++;
            this.emit('report:failed', report, error);
            throw error;
        }
    }

    async gatherReportData(template, parameters) {
        const dataPromises = template.dataSources.map(async (sourceConfig) => {
            const dataSource = this.dataSources.get(sourceConfig.sourceId);
            if (!dataSource) {
                throw new Error(`Data source '${sourceConfig.sourceId}' not found`);
            }

            const query = this.buildQuery(sourceConfig, parameters);
            const data = await this.queryDataSource(sourceConfig.sourceId, query, parameters);

            return {
                sourceId: sourceConfig.sourceId,
                alias: sourceConfig.alias,
                data: data
            };
        });

        const results = await Promise.all(dataPromises);

        // Merge data from multiple sources
        return this.mergeDataSources(results);
    }

    buildQuery(sourceConfig, parameters) {
        let query = sourceConfig.query;

        // Replace parameter placeholders
        for (const [key, value] of Object.entries(parameters)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            query = query.replace(regex, value);
        }

        return query;
    }

    mergeDataSources(dataSources) {
        if (dataSources.length === 1) {
            return dataSources[0].data;
        }

        // Simple merge strategy - combine all data
        const merged = [];
        dataSources.forEach(source => {
            if (Array.isArray(source.data)) {
                merged.push(...source.data.map(item => ({
                    ...item,
                    _source: source.alias
                })));
            }
        });

        return merged;
    }

    async applyCalculations(template, data) {
        let calculatedData = [...data];

        for (const calculation of template.calculations) {
            switch (calculation.type) {
                case 'aggregate':
                    calculatedData = this.applyAggregation(calculatedData, calculation);
                    break;
                case 'formula':
                    calculatedData = this.applyFormula(calculatedData, calculation);
                    break;
                case 'transformation':
                    calculatedData = await this.applyTransformation(calculatedData, calculation);
                    break;
            }
        }

        return calculatedData;
    }

    applyAggregation(data, calculation) {
        const groups = new Map();

        for (const item of data) {
            const key = item[calculation.groupBy];
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(item);
        }

        const aggregated = [];
        for (const [groupKey, items] of groups.entries()) {
            const aggregatedItem = { [calculation.groupBy]: groupKey };

            for (const agg of calculation.aggregations) {
                switch (agg.function) {
                    case 'sum':
                        aggregatedItem[agg.field] = items.reduce((sum, item) => sum + (item[agg.field] || 0), 0);
                        break;
                    case 'avg':
                        aggregatedItem[agg.field] = items.reduce((sum, item) => sum + (item[agg.field] || 0), 0) / items.length;
                        break;
                    case 'count':
                        aggregatedItem[agg.field] = items.length;
                        break;
                    case 'max':
                        aggregatedItem[agg.field] = Math.max(...items.map(item => item[agg.field] || 0));
                        break;
                    case 'min':
                        aggregatedItem[agg.field] = Math.min(...items.map(item => item[agg.field] || 0));
                        break;
                }
            }

            aggregated.push(aggregatedItem);
        }

        return aggregated;
    }

    applyFormula(data, calculation) {
        return data.map(item => {
            const result = { ...item };

            // Simple formula evaluation
            const formula = calculation.formula.replace(/\{\{(\w+)\}\}/g, (match, field) => {
                return item[field] || 0;
            });

            try {
                result[calculation.resultField] = eval(formula);
            } catch (error) {
                result[calculation.resultField] = null;
            }

            return result;
        });
    }

    async applyTransformation(data, calculation) {
        // Mock transformation
        return data.map(item => ({
            ...item,
            [calculation.resultField]: item[calculation.sourceField] * 1.1 // Simple transformation
        }));
    }

    applyFilters(template, data, parameters) {
        let filteredData = [...data];

        for (const filter of template.filters) {
            const paramValue = parameters[filter.parameter];

            if (paramValue !== undefined) {
                filteredData = filteredData.filter(item => {
                    const itemValue = item[filter.field];

                    switch (filter.operator) {
                        case 'equals':
                            return itemValue === paramValue;
                        case 'not_equals':
                            return itemValue !== paramValue;
                        case 'greater_than':
                            return itemValue > paramValue;
                        case 'less_than':
                            return itemValue < paramValue;
                        case 'contains':
                            return String(itemValue).includes(String(paramValue));
                        case 'in':
                            return Array.isArray(paramValue) && paramValue.includes(itemValue);
                        default:
                            return true;
                    }
                });
            }
        }

        return filteredData;
    }

    async generateVisualizations(template, data) {
        const visualizations = [];

        for (const viz of template.visualizations) {
            try {
                const visualization = await this.createVisualization(viz, data);
                visualizations.push(visualization);
            } catch (error) {
                console.error(`Failed to generate visualization '${viz.name}':`, error);
            }
        }

        return visualizations;
    }

    async createVisualization(vizConfig, data) {
        const visualization = {
            id: this.generateVisualizationId(),
            name: vizConfig.name,
            type: vizConfig.type,
            config: vizConfig.config,
            data: null
        };

        switch (vizConfig.type) {
            case 'chart':
                visualization.data = this.generateChartData(vizConfig, data);
                break;
            case 'table':
                visualization.data = this.generateTableData(vizConfig, data);
                break;
            case 'metric':
                visualization.data = this.generateMetricData(vizConfig, data);
                break;
            case 'heatmap':
                visualization.data = this.generateHeatmapData(vizConfig, data);
                break;
        }

        return visualization;
    }

    generateChartData(config, data) {
        const labels = [];
        const datasets = [];

        // Group data by x-axis field
        const grouped = new Map();
        for (const item of data) {
            const xValue = item[config.xAxis];
            if (!grouped.has(xValue)) {
                grouped.set(xValue, []);
            }
            grouped.get(xValue).push(item);
        }

        // Sort by x-axis
        const sortedEntries = Array.from(grouped.entries()).sort();

        for (const [xValue, items] of sortedEntries) {
            labels.push(xValue);

            if (!datasets.length) {
                // Create datasets based on y-axis fields
                for (const yField of config.yAxis) {
                    datasets.push({
                        label: yField,
                        data: [],
                        backgroundColor: this.getRandomColor(),
                        borderColor: this.getRandomColor()
                    });
                }
            }

            // Add data points
            for (let i = 0; i < config.yAxis.length; i++) {
                const yField = config.yAxis[i];
                const values = items.map(item => item[yField] || 0);
                const aggregatedValue = config.aggregation === 'sum' ?
                    values.reduce((sum, val) => sum + val, 0) :
                    values.reduce((sum, val) => sum + val, 0) / values.length;

                datasets[i].data.push(aggregatedValue);
            }
        }

        return { labels, datasets };
    }

    generateTableData(config, data) {
        const columns = config.columns || Object.keys(data[0] || {});
        const rows = data.map(item => {
            const row = {};
            for (const column of columns) {
                row[column] = item[column];
            }
            return row;
        });

        return { columns, rows };
    }

    generateMetricData(config, data) {
        let value;

        if (config.aggregation === 'count') {
            value = data.length;
        } else if (config.field) {
            const values = data.map(item => item[config.field] || 0);
            switch (config.aggregation) {
                case 'sum':
                    value = values.reduce((sum, val) => sum + val, 0);
                    break;
                case 'avg':
                    value = values.reduce((sum, val) => sum + val, 0) / values.length;
                    break;
                case 'max':
                    value = Math.max(...values);
                    break;
                case 'min':
                    value = Math.min(...values);
                    break;
                default:
                    value = values[0];
            }
        }

        return {
            value: value,
            formatted: this.formatMetric(value, config.format),
            trend: config.showTrend ? this.calculateTrend(data, config) : null
        };
    }

    generateHeatmapData(config, data) {
        const matrix = [];
        const xLabels = new Set();
        const yLabels = new Set();

        // Collect all labels
        for (const item of data) {
            xLabels.add(item[config.xAxis]);
            yLabels.add(item[config.yAxis]);
        }

        const xArray = Array.from(xLabels);
        const yArray = Array.from(yLabels);

        // Initialize matrix
        for (let i = 0; i < yArray.length; i++) {
            matrix[i] = new Array(xArray.length).fill(0);
        }

        // Fill matrix
        for (const item of data) {
            const xIndex = xArray.indexOf(item[config.xAxis]);
            const yIndex = yArray.indexOf(item[config.yAxis]);
            const value = item[config.valueField] || 1;

            matrix[yIndex][xIndex] += value;
        }

        return {
            matrix: matrix,
            xLabels: xArray,
            yLabels: yArray
        };
    }

    formatMetric(value, format) {
        if (!format) return value;

        switch (format.type) {
            case 'currency':
                return new Intl.NumberFormat(format.locale || 'en-US', {
                    style: 'currency',
                    currency: format.currency || 'USD'
                }).format(value);
            case 'number':
                return new Intl.NumberFormat(format.locale || 'en-US', format.options).format(value);
            case 'percentage':
                return new Intl.NumberFormat(format.locale || 'en-US', {
                    style: 'percent',
                    minimumFractionDigits: 1
                }).format(value / 100);
            default:
                return value;
        }
    }

    calculateTrend(data, config) {
        // Simple trend calculation
        if (data.length < 2) return null;

        const current = data[data.length - 1][config.field] || 0;
        const previous = data[data.length - 2][config.field] || 0;

        const change = current - previous;
        const percentChange = previous !== 0 ? (change / previous) * 100 : 0;

        return {
            direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
            change: change,
            percentChange: percentChange
        };
    }

    getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    // Report Export
    async exportReport(reportId, format = null, options = {}) {
        const report = this.reports.get(reportId);
        if (!report) {
            throw new Error(`Report '${reportId}' not found`);
        }

        if (report.status !== 'completed') {
            throw new Error('Report is not ready for export');
        }

        const exportFormat = format || report.metadata.format;
        const exportData = await this.generateExport(report, exportFormat, options);

        // Save to file
        const fileName = `report_${reportId}_${Date.now()}.${exportFormat}`;
        const filePath = path.join(this.storagePath, fileName);

        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }

        fs.writeFileSync(filePath, exportData);

        this.metrics.totalExports++;
        this.audit('report_exported', { reportId, format: exportFormat, filePath });

        return {
            filePath: filePath,
            fileName: fileName,
            format: exportFormat,
            size: exportData.length
        };
    }

    async generateExport(report, format, options) {
        const template = this.templates.get(report.templateId);

        switch (format) {
            case 'pdf':
                return await this.generatePDFExport(report, template, options);
            case 'excel':
                return await this.generateExcelExport(report, template, options);
            case 'csv':
                return await this.generateCSVExport(report, template, options);
            case 'json':
                return JSON.stringify(report.data, null, 2);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    async generatePDFExport(report, template, options) {
        // Mock PDF generation
        let pdfContent = `
${template.name}
Generated: ${report.generatedAt}

`;

        if (report.data.visualizations) {
            for (const viz of report.data.visualizations) {
                pdfContent += `${viz.name}: ${JSON.stringify(viz.data, null, 2)}\n\n`;
            }
        }

        if (report.data.filtered) {
            pdfContent += 'Data:\n';
            for (const item of report.data.filtered.slice(0, 10)) {
                pdfContent += JSON.stringify(item, null, 2) + '\n';
            }
        }

        return pdfContent;
    }

    async generateExcelExport(report, template, options) {
        // Mock Excel generation
        let csv = '';

        if (report.data.filtered && report.data.filtered.length > 0) {
            const headers = Object.keys(report.data.filtered[0]);
            csv += headers.join(',') + '\n';

            for (const item of report.data.filtered) {
                const values = headers.map(header => item[header] || '');
                csv += values.join(',') + '\n';
            }
        }

        return csv;
    }

    async generateCSVExport(report, template, options) {
        let csv = '';

        if (report.data.filtered && report.data.filtered.length > 0) {
            const headers = Object.keys(report.data.filtered[0]);
            csv += headers.join(',') + '\n';

            for (const item of report.data.filtered) {
                const values = headers.map(header => {
                    const value = item[header];
                    if (typeof value === 'object') {
                        return JSON.stringify(value);
                    }
                    return value || '';
                });
                csv += values.map(v => `"${v}"`).join(',') + '\n';
            }
        }

        return csv;
    }

    // Scheduled Reports
    scheduleReport(scheduleId, templateId, scheduleConfig, parameters = {}) {
        const scheduledReport = {
            id: scheduleId,
            templateId: templateId,
            schedule: scheduleConfig,
            parameters: parameters,
            nextRun: this.calculateNextRun(scheduleConfig),
            enabled: true,
            createdAt: new Date(),
            lastRun: null,
            runCount: 0,
            status: 'scheduled'
        };

        this.scheduledReports.set(scheduleId, scheduledReport);

        // Set up the actual scheduling (mock implementation)
        const interval = this.parseSchedule(scheduleConfig);
        if (interval) {
            setInterval(() => {
                this.runScheduledReport(scheduleId);
            }, interval);
        }

        return scheduledReport;
    }

    calculateNextRun(scheduleConfig) {
        // Simple next run calculation
        const now = new Date();

        if (scheduleConfig.type === 'interval') {
            return new Date(now.getTime() + scheduleConfig.interval);
        } else if (scheduleConfig.type === 'daily') {
            const nextRun = new Date(now);
            nextRun.setDate(nextRun.getDate() + 1);
            nextRun.setHours(scheduleConfig.hour || 0, scheduleConfig.minute || 0, 0, 0);
            return nextRun;
        } else if (scheduleConfig.type === 'weekly') {
            const nextRun = new Date(now);
            const daysUntilTarget = (scheduleConfig.dayOfWeek - now.getDay() + 7) % 7;
            nextRun.setDate(nextRun.getDate() + (daysUntilTarget || 7));
            nextRun.setHours(scheduleConfig.hour || 0, scheduleConfig.minute || 0, 0, 0);
            return nextRun;
        }

        return now;
    }

    parseSchedule(scheduleConfig) {
        if (scheduleConfig.type === 'interval') {
            return scheduleConfig.interval;
        }
        // For cron-like schedules, return a default interval
        return 24 * 60 * 60 * 1000; // Daily
    }

    async runScheduledReport(scheduleId) {
        const scheduledReport = this.scheduledReports.get(scheduleId);
        if (!scheduledReport || !scheduledReport.enabled) {
            return;
        }

        try {
            const report = await this.generateReport(
                scheduledReport.templateId,
                scheduledReport.parameters
            );

            scheduledReport.lastRun = new Date();
            scheduledReport.runCount++;
            scheduledReport.nextRun = this.calculateNextRun(scheduledReport.schedule);
            scheduledReport.status = 'completed';

            // Auto-export if configured
            if (scheduledReport.autoExport) {
                await this.exportReport(report.id, scheduledReport.exportFormat);
            }

            this.emit('scheduled_report:completed', scheduledReport, report);

        } catch (error) {
            scheduledReport.status = 'failed';
            this.emit('scheduled_report:failed', scheduledReport, error);
        }
    }

    // Cache Management
    setCache(key, value, ttl = null) {
        const expiry = ttl || this.cacheTTL;
        this.cache.set(key, {
            value: value,
            expiry: Date.now() + expiry,
            created: Date.now()
        });
    }

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) {
            return null;
        }

        if (Date.now() > cached.expiry) {
            this.cache.delete(key);
            return null;
        }

        return cached.value;
    }

    clearCache() {
        this.cache.clear();
    }

    cleanupCache() {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            if (now > cached.expiry) {
                this.cache.delete(key);
            }
        }
    }

    // Permissions
    setPermissions(templateId, permissions) {
        this.permissions.set(templateId, permissions);
    }

    checkPermission(templateId, userId, action = 'view') {
        const templatePermissions = this.permissions.get(templateId);
        if (!templatePermissions) {
            return true; // No restrictions
        }

        const userPermissions = templatePermissions.users?.[userId];
        if (userPermissions && userPermissions.includes(action)) {
            return true;
        }

        // Check role-based permissions
        for (const role of templatePermissions.roles || []) {
            if (role.actions.includes(action)) {
                // In a real system, you'd check if user has this role
                return true;
            }
        }

        return false;
    }

    // Audit
    audit(action, details) {
        if (!this.enableAudit) return;

        const auditEntry = {
            id: this.generateAuditId(),
            action: action,
            details: details,
            timestamp: new Date(),
            userId: details.userId
        };

        this.auditLog.push(auditEntry);

        // Keep only last 10000 audit entries
        if (this.auditLog.length > 10000) {
            this.auditLog = this.auditLog.slice(-10000);
        }
    }

    getAuditLog(filters = {}) {
        let logs = this.auditLog;

        if (filters.action) {
            logs = logs.filter(log => log.action === filters.action);
        }

        if (filters.userId) {
            logs = logs.filter(log => log.userId === filters.userId);
        }

        if (filters.startDate) {
            logs = logs.filter(log => log.timestamp >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            logs = logs.filter(log => log.timestamp <= new Date(filters.endDate));
        }

        return logs;
    }

    // Metrics and Analytics
    getMetrics() {
        const templateUsage = {};
        for (const template of this.templates.values()) {
            templateUsage[template.id] = template.usageCount;
        }

        const reportStatus = {};
        for (const report of this.reports.values()) {
            reportStatus[report.status] = (reportStatus[report.status] || 0) + 1;
        }

        return {
            ...this.metrics,
            templateUsage: templateUsage,
            reportStatus: reportStatus,
            cacheSize: this.cache.size,
            dataSourcesCount: this.dataSources.size,
            scheduledReportsCount: this.scheduledReports.size
        };
    }

    // Export/Import
    exportConfiguration() {
        return {
            templates: Array.from(this.templates.entries()),
            dataSources: Array.from(this.dataSources.entries()),
            scheduledReports: Array.from(this.scheduledReports.entries()),
            permissions: Array.from(this.permissions.entries()),
            config: {
                cacheEnabled: this.cacheEnabled,
                cacheTTL: this.cacheTTL,
                maxConcurrency: this.maxConcurrency,
                timeout: this.timeout,
                enableAudit: this.enableAudit,
                defaultFormat: this.defaultFormat,
                storagePath: this.storagePath
            }
        };
    }

    importConfiguration(data) {
        // Clear existing data
        this.templates.clear();
        this.dataSources.clear();
        this.scheduledReports.clear();
        this.permissions.clear();

        // Import data
        for (const [id, template] of data.templates) {
            this.templates.set(id, template);
        }

        for (const [id, dataSource] of data.dataSources) {
            this.dataSources.set(id, dataSource);
        }

        for (const [id, scheduledReport] of data.scheduledReports) {
            this.scheduledReports.set(id, scheduledReport);
        }

        for (const [id, permission] of data.permissions) {
            this.permissions.set(id, permission);
        }

        // Import config
        const config = data.config;
        if (config) {
            this.cacheEnabled = config.cacheEnabled || true;
            this.cacheTTL = config.cacheTTL || 3600000;
            this.maxConcurrency = config.maxConcurrency || 5;
            this.timeout = config.timeout || 300000;
            this.enableAudit = config.enableAudit || true;
            this.defaultFormat = config.defaultFormat || 'pdf';
            this.storagePath = config.storagePath || './reports';
        }

        return true;
    }

    // Utility Methods
    generateReportId() {
        return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateVisualizationId() {
        return `viz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateAuditId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Cleanup
    cleanup() {
        this.cleanupCache();

        // Remove old reports (older than 30 days)
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const oldReports = [];

        for (const [id, report] of this.reports.entries()) {
            if (report.createdAt < cutoff) {
                oldReports.push(id);
            }
        }

        for (const id of oldReports) {
            this.reports.delete(id);
        }

        // Archive old audit logs
        if (this.auditLog.length > 5000) {
            this.auditLog = this.auditLog.slice(-5000);
        }
    }

    // Real-time updates
    enableRealTimeUpdates() {
        this.realTimeEnabled = true;
        return this;
    }

    subscribeToUpdates(templateId, callback) {
        const listener = (report) => {
            if (report.templateId === templateId) {
                callback(report);
            }
        };

        this.on('report:completed', listener);
        return () => this.off('report:completed', listener);
    }

    // Dashboard support
    createDashboard(dashboardId, dashboardConfig) {
        const dashboard = {
            id: dashboardId,
            name: dashboardConfig.name,
            description: dashboardConfig.description,
            widgets: dashboardConfig.widgets || [],
            layout: dashboardConfig.layout || {},
            refreshInterval: dashboardConfig.refreshInterval || 300000, // 5 minutes
            createdAt: new Date(),
            lastUpdated: null
        };

        this.dashboards = this.dashboards || new Map();
        this.dashboards.set(dashboardId, dashboard);
        return dashboard;
    }

    async refreshDashboard(dashboardId) {
        const dashboard = this.dashboards?.get(dashboardId);
        if (!dashboard) {
            throw new Error(`Dashboard '${dashboardId}' not found`);
        }

        const updatedWidgets = [];
        for (const widget of dashboard.widgets) {
            try {
                const updatedWidget = await this.refreshWidget(widget);
                updatedWidgets.push(updatedWidget);
            } catch (error) {
                console.error(`Failed to refresh widget ${widget.id}:`, error);
                updatedWidgets.push(widget);
            }
        }

        dashboard.widgets = updatedWidgets;
        dashboard.lastUpdated = new Date();

        return dashboard;
    }

    async refreshWidget(widget) {
        if (widget.type === 'report') {
            const report = await this.generateReport(widget.templateId, widget.parameters);
            return {
                ...widget,
                data: report.data,
                lastUpdated: new Date()
            };
        }

        return widget;
    }

    // Plugin system
    registerPlugin(pluginName, plugin) {
        this.plugins = this.plugins || new Map();
        this.plugins.set(pluginName, plugin);

        if (plugin.init) {
            plugin.init(this);
        }
    }

    unregisterPlugin(pluginName) {
        const plugin = this.plugins?.get(pluginName);
        if (plugin && plugin.destroy) {
            plugin.destroy(this);
        }
        this.plugins?.delete(pluginName);
    }

    // Final cleanup
    destroy() {
        this.templates.clear();
        this.reports.clear();
        this.dataSources.clear();
        this.scheduledReports.clear();
        this.cache.clear();
        this.permissions.clear();
        this.auditLog = [];
        this.reportHistory = [];
        this.removeAllListeners();
    }
}

module.exports = ReportingEngine;
