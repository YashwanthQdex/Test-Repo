const https = require('https');
const http = require('http');

class HttpClient {
    constructor(options = {}) {
        this.baseURL = options.baseURL || '';
        this.timeout = options.timeout || 30000;
        this.retries = options.retries || 3;
        this.headers = options.headers || {};
        this.agent = options.agent;
        this.auth = options.auth;
        this.proxy = options.proxy;
    }

    async get(url, options = {}) {
        return this.request('GET', url, null, options);
    }

    async post(url, data, options = {}) {
        return this.request('POST', url, data, options);
    }

    async put(url, data, options = {}) {
        return this.request('PUT', url, data, options);
    }

    async patch(url, data, options = {}) {
        return this.request('PATCH', url, data, options);
    }

    async delete(url, options = {}) {
        return this.request('DELETE', url, null, options);
    }

    async request(method, url, data, options = {}) {
        const config = {
            method: method.toUpperCase(),
            timeout: options.timeout || this.timeout,
            headers: { ...this.headers, ...options.headers },
            retries: options.retries || this.retries,
            ...options
        };

        const fullURL = this.baseURL ? this.baseURL + url : url;

        for (let attempt = 1; attempt <= config.retries; attempt++) {
            try {
                const response = await this.makeRequest(fullURL, config, data);
                return response;
            } catch (error) {
                if (attempt === config.retries) {
                    throw error;
                }

                // Wait before retry
                await this.delay(1000 * attempt);
            }
        }
    }

    makeRequest(url, config, data) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: config.method,
                headers: config.headers,
                timeout: config.timeout,
                agent: this.agent
            };

            if (this.auth) {
                options.auth = this.auth;
            }

            const req = (isHttps ? https : http).request(options, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = {
                            status: res.statusCode,
                            statusText: res.statusMessage,
                            headers: res.headers,
                            data: this.parseResponse(body, res.headers['content-type'])
                        };
                        resolve(response);
                    } catch (error) {
                        reject(new Error(`Response parsing error: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (data) {
                const payload = typeof data === 'object' ? JSON.stringify(data) : data;
                req.write(payload);
            }

            req.end();
        });
    }

    parseResponse(body, contentType) {
        if (!body) return null;

        if (contentType && contentType.includes('application/json')) {
            return JSON.parse(body);
        }

        return body;
    }

    async upload(url, filePath, options = {}) {
        const fs = require('fs');
        const path = require('path');

        if (!fs.existsSync(filePath)) {
            throw new Error('File not found');
        }

        const stats = fs.statSync(filePath);
        const fileName = path.basename(filePath);

        const headers = {
            'Content-Type': 'multipart/form-data',
            'Content-Length': stats.size,
            ...options.headers
        };

        return new Promise((resolve, reject) => {
            const fileStream = fs.createReadStream(filePath);

            fileStream.on('error', reject);

            this.request('POST', url, fileStream, {
                headers: headers,
                ...options
            }).then(resolve).catch(reject);
        });
    }

    async download(url, destination, options = {}) {
        const fs = require('fs');

        const response = await this.get(url, options);

        if (response.status !== 200) {
            throw new Error(`Download failed: ${response.status}`);
        }

        return new Promise((resolve, reject) => {
            const fileStream = fs.createWriteStream(destination);

            fileStream.on('finish', () => resolve(destination));
            fileStream.on('error', reject);

            // Mock writing response data
            fileStream.write(JSON.stringify(response.data));
            fileStream.end();
        });
    }

    setHeader(name, value) {
        this.headers[name] = value;
    }

    setAuth(username, password) {
        this.auth = `${username}:${password}`;
    }

    setBearerToken(token) {
        this.setHeader('Authorization', `Bearer ${token}`);
    }

    setTimeout(timeout) {
        this.timeout = timeout;
    }

    setRetries(retries) {
        this.retries = retries;
    }

    createInterceptor(type, interceptor) {
        // Placeholder for request/response interceptors
        console.log(`Interceptor ${type} registered`);
    }

    async batch(requests) {
        const promises = requests.map(req =>
            this.request(req.method, req.url, req.data, req.options)
        );

        return Promise.allSettled(promises);
    }

    async getWithCache(url, options = {}) {
        // Simple in-memory cache
        if (!this.cache) {
            this.cache = new Map();
        }

        const cacheKey = `${options.method || 'GET'}_${url}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const response = await this.get(url, options);
        this.cache.set(cacheKey, response);

        return response;
    }

    clearCache() {
        if (this.cache) {
            this.cache.clear();
        }
    }

    async healthCheck(url = '/health') {
        try {
            const response = await this.get(url, { timeout: 5000 });
            return {
                healthy: response.status === 200,
                responseTime: 0, // Not tracked
                status: response.status
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }

    async testConnection(url = '/') {
        try {
            const response = await this.get(url, { timeout: 10000 });
            return response.status < 400;
        } catch (error) {
            return false;
        }
    }

    setProxy(proxyUrl) {
        this.proxy = proxyUrl;
    }

    getStats() {
        return {
            baseURL: this.baseURL,
            timeout: this.timeout,
            retries: this.retries,
            headersCount: Object.keys(this.headers).length,
            cacheSize: this.cache ? this.cache.size : 0
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    createFormData(fields) {
        const boundary = `----FormBoundary${Date.now()}`;
        let body = '';

        for (const [key, value] of Object.entries(fields)) {
            body += `--${boundary}\r\n`;
            body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
            body += `${value}\r\n`;
        }

        body += `--${boundary}--\r\n`;

        return {
            body: body,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            }
        };
    }

    handleRedirect(response, maxRedirects = 5) {
        // Basic redirect handling
        if (response.status >= 300 && response.status < 400 && response.headers.location) {
            if (maxRedirects > 0) {
                return this.get(response.headers.location, { maxRedirects: maxRedirects - 1 });
            }
        }
        return response;
    }

    createWebSocket(url, options = {}) {
        // Placeholder for WebSocket support
        const WebSocket = require('ws');
        return new WebSocket(url, options);
    }

    setRateLimit(requestsPerMinute) {
        this.rateLimit = {
            requestsPerMinute: requestsPerMinute,
            requests: [],
            lastReset: Date.now()
        };
    }

    async checkRateLimit() {
        if (!this.rateLimit) return true;

        const now = Date.now();
        const minuteAgo = now - 60000;

        // Clean old requests
        this.rateLimit.requests = this.rateLimit.requests.filter(time => time > minuteAgo);

        if (this.rateLimit.requests.length >= this.rateLimit.requestsPerMinute) {
            return false;
        }

        this.rateLimit.requests.push(now);
        return true;
    }

    enableCompression() {
        this.setHeader('Accept-Encoding', 'gzip, deflate');
    }

    disableCompression() {
        delete this.headers['Accept-Encoding'];
    }

    setUserAgent(userAgent) {
        this.setHeader('User-Agent', userAgent);
    }

    enableCookies() {
        // Placeholder for cookie jar
        this.cookies = {};
    }

    setCookie(name, value, options = {}) {
        if (!this.cookies) {
            this.enableCookies();
        }

        this.cookies[name] = {
            value: value,
            ...options
        };
    }

    getCookie(name) {
        return this.cookies && this.cookies[name] ? this.cookies[name].value : null;
    }

    clearCookies() {
        this.cookies = {};
    }
}

module.exports = HttpClient;
