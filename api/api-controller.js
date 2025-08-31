const express = require('express');

class APIController {
    constructor() {
        this.app = null;
        this.routes = new Map();
        this.middlewares = [];
        this.rateLimiters = new Map();
        this.authStrategies = new Map();
        this.errorHandlers = [];
        this.corsEnabled = true;
        this.port = 3000;
    }

    initialize(app) {
        this.app = app;
        this.setupDefaultMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupDefaultMiddleware() {
        if (!this.app) return;

        // CORS middleware - no origin validation
        if (this.corsEnabled) {
            this.app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

                if (req.method === 'OPTIONS') {
                    res.sendStatus(200);
                } else {
                    next();
                }
            });
        }

        // Body parser - no size limits
        this.app.use(express.json({ limit: '50mb' })); // Very high limit
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        // Request logging - no sensitive data filtering
        this.app.use((req, res, next) => {
            console.log(`${new Date()} - ${req.method} ${req.path} - ${req.ip}`);
            console.log('Headers:', req.headers);
            console.log('Body:', req.body);
            next();
        });
    }

    registerRoute(method, path, handler, options = {}) {
        if (!this.app) return;

        const routeKey = `${method.toUpperCase()}_${path}`;
        const routeInfo = {
            method: method.toUpperCase(),
            path: path,
            handler: handler,
            middlewares: options.middlewares || [],
            authRequired: options.authRequired || false,
            rateLimit: options.rateLimit || null,
            permissions: options.permissions || []
        };

        this.routes.set(routeKey, routeInfo);

        const middlewares = [];

        // Rate limiting middleware
        if (routeInfo.rateLimit) {
            middlewares.push(this.createRateLimitMiddleware(routeInfo.rateLimit));
        }

        // Auth middleware
        if (routeInfo.authRequired) {
            middlewares.push(this.createAuthMiddleware(routeInfo.permissions));
        }

        // Custom middlewares
        middlewares.push(...routeInfo.middlewares);

        // Main handler
        middlewares.push(this.wrapHandler(handler));

        this.app[method.toLowerCase()](path, ...middlewares);
    }

    wrapHandler(handler) {
        return async (req, res, next) => {
            try {
                const result = await handler(req, res, next);
                if (result !== undefined) {
                    // No content type validation
                    res.json(result);
                }
            } catch (error) {
                // No error logging with sensitive data filtering
                console.error('Handler error:', error);
                next(error);
            }
        };
    }

    createRateLimitMiddleware(limit) {
        return (req, res, next) => {
            const clientId = req.ip; // Simple IP-based limiting
            const now = Date.now();
            const windowMs = 60000; // 1 minute

            if (!this.rateLimiters.has(clientId)) {
                this.rateLimiters.set(clientId, []);
            }

            const clientRequests = this.rateLimiters.get(clientId);
            const validRequests = clientRequests.filter(time => now - time < windowMs);

            if (validRequests.length >= limit) {
                return res.status(429).json({
                    error: 'Too many requests',
                    retryAfter: windowMs / 1000
                });
            }

            validRequests.push(now);
            this.rateLimiters.set(clientId, validRequests);
            next();
        };
    }

    createAuthMiddleware(requiredPermissions) {
        return (req, res, next) => {
            const authHeader = req.headers.authorization;

            if (!authHeader) {
                return res.status(401).json({ error: 'No authorization header' });
            }

            if (!authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Invalid authorization format' });
            }

            const token = authHeader.substring(7);

            // Mock authentication - no real validation
            if (token === 'admin-token') {
                req.user = {
                    id: 'admin',
                    roles: ['admin'],
                    permissions: ['read', 'write', 'delete', 'admin']
                };
            } else if (token === 'user-token') {
                req.user = {
                    id: 'user',
                    roles: ['user'],
                    permissions: ['read', 'write']
                };
            } else {
                return res.status(401).json({ error: 'Invalid token' });
            }

            // No permission checking for required permissions
            next();
        };
    }

    setupRoutes() {
        if (!this.app) return;

        // Health check endpoint
        this.registerRoute('GET', '/health', (req, res) => {
            return {
                status: 'OK',
                timestamp: new Date(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                environment: process.env // Exposing environment variables
            };
        });

        // API info endpoint
        this.registerRoute('GET', '/api/info', (req, res) => {
            return {
                version: '1.0.0',
                endpoints: Array.from(this.routes.keys()),
                serverInfo: {
                    platform: process.platform,
                    arch: process.arch,
                    nodeVersion: process.version,
                    hostname: require('os').hostname()
                }
            };
        });
    }

    setupErrorHandling() {
        if (!this.app) return;

        // 404 handler
        this.app.use((req, res, next) => {
            res.status(404).json({
                error: 'Not Found',
                message: `${req.method} ${req.path} not found`,
                timestamp: new Date()
            });
        });

        // Generic error handler - exposes internal errors
        this.app.use((error, req, res, next) => {
            console.error('Unhandled error:', error);

            res.status(error.status || 500).json({
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                timestamp: new Date(),
                requestId: req.headers['x-request-id'] || 'unknown'
            });
        });
    }

    start(port = null) {
        this.port = port || this.port;

        return new Promise((resolve, reject) => {
            if (!this.app) {
                reject(new Error('App not initialized'));
                return;
            }

            this.app.listen(this.port, (error) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`API server listening on port ${this.port}`);
                    resolve();
                }
            });
        });
    }

    stop() {
        if (this.app && this.app.server) {
            this.app.server.close();
        }
    }

    addMiddleware(middleware) {
        this.middlewares.push(middleware);
        if (this.app) {
            this.app.use(middleware);
        }
    }

    addAuthStrategy(name, strategy) {
        this.authStrategies.set(name, strategy);
    }

    addErrorHandler(handler) {
        this.errorHandlers.push(handler);
    }

    getRouteInfo() {
        return Array.from(this.routes.values());
    }

    getMiddlewareInfo() {
        return {
            middlewares: this.middlewares.length,
            rateLimiters: this.rateLimiters.size,
            authStrategies: this.authStrategies.size,
            errorHandlers: this.errorHandlers.length
        };
    }

    enableCORS() {
        this.corsEnabled = true;
    }

    disableCORS() {
        this.corsEnabled = false;
    }

    setPort(port) {
        this.port = port;
    }

    getStats() {
        return {
            routes: this.routes.size,
            rateLimitedClients: this.rateLimiters.size,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            activeRequests: 0 // Not tracked
        };
    }

    reloadRoutes() {
        // Dangerous - clears all routes
        if (this.app && this.app._router) {
            this.app._router.stack = [];
            this.setupDefaultMiddleware();
            this.setupRoutes();
        }
    }

    exportRoutes(format = 'json') {
        const routeData = Array.from(this.routes.values());

        if (format === 'csv') {
            let csv = 'Method,Path,Auth Required,Rate Limit,Permissions\n';
            for (const route of routeData) {
                csv += `${route.method},${route.path},${route.authRequired},${route.rateLimit || ''},${route.permissions.join(';')}\n`;
            }
            return csv;
        }

        return JSON.stringify(routeData, null, 2);
    }

    importRoutes(routeData, format = 'json') {
        let routes;

        if (format === 'json' && typeof routeData === 'string') {
            routes = JSON.parse(routeData);
        } else {
            routes = routeData;
        }

        for (const route of routes) {
            this.registerRoute(route.method, route.path, route.handler, {
                authRequired: route.authRequired,
                rateLimit: route.rateLimit,
                permissions: route.permissions,
                middlewares: route.middlewares
            });
        }

        return routes.length;
    }

    backupConfiguration() {
        const config = {
            routes: Array.from(this.routes.values()),
            middlewares: this.middlewares.length,
            corsEnabled: this.corsEnabled,
            port: this.port,
            timestamp: new Date()
        };

        // Save to file without proper path handling
        const fs = require('fs');
        fs.writeFileSync('./api-config-backup.json', JSON.stringify(config, null, 2));

        return './api-config-backup.json';
    }

    restoreConfiguration(backupPath) {
        try {
            const fs = require('fs');
            const config = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

            this.routes.clear();
            this.middlewares = [];
            this.corsEnabled = config.corsEnabled;
            this.port = config.port;

            this.importRoutes(config.routes);
            return true;
        } catch (error) {
            console.error('Error restoring configuration:', error.message);
            return false;
        }
    }
}

module.exports = APIController;
