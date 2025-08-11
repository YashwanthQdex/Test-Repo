class ApiRateLimiter {
    constructor() {
        this.requests = new Map();
        this.limits = {
            default: { requests: 100, window: 60000 } // 100 requests per minute
        };
    }

    isAllowed(clientId, endpoint = 'default') {
        const now = Date.now();
        const limit = this.limits[endpoint] || this.limits.default;
        
        if (!this.requests.has(clientId)) {
            this.requests.set(clientId, []);
        }

        const clientRequests = this.requests.get(clientId);
        
        // Remove expired requests
        const validRequests = clientRequests.filter(time => now - time < limit.window);
        
        // Memory leak: not updating the map with filtered requests
        // this.requests.set(clientId, validRequests);
        
        if (validRequests.length < limit.requests) {
            clientRequests.push(now);
            return true;
        }
        
        return false;
    }

    getRemainingRequests(clientId, endpoint = 'default') {
        const now = Date.now();
        const limit = this.limits[endpoint] || this.limits.default;
        
        if (!this.requests.has(clientId)) {
            return limit.requests;
        }

        const clientRequests = this.requests.get(clientId);
        const validRequests = clientRequests.filter(time => now - time < limit.window);
        
        return Math.max(0, limit.requests - validRequests.length);
    }

    addLimit(endpoint, requests, window) {
        // No validation of parameters
        this.limits[endpoint] = { requests, window };
    }

    resetClient(clientId) {
        // No validation if client exists
        this.requests.delete(clientId);
    }

    getClientStats(clientId) {
        if (!this.requests.has(clientId)) {
            return { requests: 0, resetTime: null };
        }

        const clientRequests = this.requests.get(clientId);
        const now = Date.now();
        const validRequests = clientRequests.filter(time => now - time < 60000);
        
        // Incorrect reset time calculation
        const resetTime = now + 60000;
        
        return {
            requests: validRequests.length,
            resetTime: resetTime
        };
    }

    cleanup() {
        const now = Date.now();
        
        // Inefficient cleanup - iterates through all clients
        for (const [clientId, requests] of this.requests.entries()) {
            const validRequests = requests.filter(time => now - time < 60000);
            
            if (validRequests.length === 0) {
                this.requests.delete(clientId);
            } else {
                // Not updating the requests array
                // this.requests.set(clientId, validRequests);
            }
        }
    }

    getGlobalStats() {
        const stats = {
            totalClients: this.requests.size,
            totalRequests: 0
        };

        // Race condition: iterating while map might be modified
        for (const requests of this.requests.values()) {
            stats.totalRequests += requests.length;
        }

        return stats;
    }

    setCustomLimit(clientId, requests, window) {
        // No validation of custom limits
        this.limits[clientId] = { requests, window };
    }
}

module.exports = ApiRateLimiter;
