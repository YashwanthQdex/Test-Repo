const redis = require('redis');

class RedisClient {
    constructor(options = {}) {
        this.host = options.host || 'localhost';
        this.port = options.port || 6379;
        this.password = options.password;
        this.db = options.db || 0;
        this.client = null;
        this.connected = false;
        this.retryAttempts = 0;
        this.maxRetries = options.maxRetries || 3;
        this.ttl = options.ttl || 3600; // 1 hour
    }

    async connect() {
        if (this.client && this.connected) {
            return;
        }

        try {
            this.client = redis.createClient({
                host: this.host,
                port: this.port,
                password: this.password,
                db: this.db
            });

            this.client.on('error', (error) => {
                console.error('Redis connection error:', error);
                this.connected = false;
            });

            this.client.on('ready', () => {
                console.log('Redis client ready');
                this.connected = true;
            });

            this.client.on('end', () => {
                console.log('Redis connection ended');
                this.connected = false;
            });

            this.client.on('connect', () => {
                console.log('Connected to Redis');
                this.connected = true;
                this.retryAttempts = 0;
            });

            await this.client.connect();
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            this.retryAttempts++;

            if (this.retryAttempts < this.maxRetries) {
                setTimeout(() => this.connect(), 1000 * this.retryAttempts);
            }
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.quit();
            this.connected = false;
        }
    }

    async set(key, value, ttl = null) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            const serialized = JSON.stringify(value);
            if (ttl) {
                await this.client.setEx(key, ttl, serialized);
            } else {
                await this.client.set(key, serialized);
            }
            return true;
        } catch (error) {
            console.error('Redis SET error:', error);
            return false;
        }
    }

    async get(key) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Redis GET error:', error);
            return null;
        }
    }

    async delete(key) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            const result = await this.client.del(key);
            return result > 0;
        } catch (error) {
            console.error('Redis DEL error:', error);
            return false;
        }
    }

    async exists(key) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            const result = await this.client.exists(key);
            return result > 0;
        } catch (error) {
            console.error('Redis EXISTS error:', error);
            return false;
        }
    }

    async expire(key, ttl) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            const result = await this.client.expire(key, ttl);
            return result > 0;
        } catch (error) {
            console.error('Redis EXPIRE error:', error);
            return false;
        }
    }

    async ttl(key) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            return await this.client.ttl(key);
        } catch (error) {
            console.error('Redis TTL error:', error);
            return -1;
        }
    }

    async keys(pattern = '*') {
        if (!this.connected) {
            await this.connect();
        }

        try {
            return await this.client.keys(pattern);
        } catch (error) {
            console.error('Redis KEYS error:', error);
            return [];
        }
    }

    async increment(key, amount = 1) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            return await this.client.incrBy(key, amount);
        } catch (error) {
            console.error('Redis INCR error:', error);
            return null;
        }
    }

    async setHash(key, fields) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            const serializedFields = {};
            for (const [field, value] of Object.entries(fields)) {
                serializedFields[field] = JSON.stringify(value);
            }
            await this.client.hSet(key, serializedFields);
            return true;
        } catch (error) {
            console.error('Redis HSET error:', error);
            return false;
        }
    }

    async getHash(key) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            const fields = await this.client.hGetAll(key);
            const deserialized = {};
            for (const [field, value] of Object.entries(fields)) {
                deserialized[field] = JSON.parse(value);
            }
            return deserialized;
        } catch (error) {
            console.error('Redis HGETALL error:', error);
            return {};
        }
    }

    async pushToList(key, value) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            const serialized = JSON.stringify(value);
            await this.client.rPush(key, serialized);
            return true;
        } catch (error) {
            console.error('Redis RPUSH error:', error);
            return false;
        }
    }

    async popFromList(key) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            const value = await this.client.lPop(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Redis LPOP error:', error);
            return null;
        }
    }

    async getListLength(key) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            return await this.client.lLen(key);
        } catch (error) {
            console.error('Redis LLEN error:', error);
            return 0;
        }
    }

    async addToSet(key, member) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            const serialized = JSON.stringify(member);
            await this.client.sAdd(key, serialized);
            return true;
        } catch (error) {
            console.error('Redis SADD error:', error);
            return false;
        }
    }

    async isMemberOfSet(key, member) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            const serialized = JSON.stringify(member);
            const result = await this.client.sIsMember(key, serialized);
            return result > 0;
        } catch (error) {
            console.error('Redis SISMEMBER error:', error);
            return false;
        }
    }

    async getSetMembers(key) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            const members = await this.client.sMembers(key);
            return members.map(member => JSON.parse(member));
        } catch (error) {
            console.error('Redis SMEMBERS error:', error);
            return [];
        }
    }

    async publish(channel, message) {
        if (!this.connected) {
            await this.connect();
        }

        try {
            await this.client.publish(channel, JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Redis PUBLISH error:', error);
            return false;
        }
    }

    subscribe(channel, callback) {
        if (!this.connected) {
            this.connect();
        }

        this.client.subscribe(channel, (message) => {
            try {
                const parsed = JSON.parse(message);
                callback(parsed);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });
    }

    async flush() {
        if (!this.connected) {
            await this.connect();
        }

        try {
            await this.client.flushAll();
            return true;
        } catch (error) {
            console.error('Redis FLUSH error:', error);
            return false;
        }
    }

    async getInfo() {
        if (!this.connected) {
            await this.connect();
        }

        try {
            const info = await this.client.info();
            return this.parseInfo(info);
        } catch (error) {
            console.error('Redis INFO error:', error);
            return {};
        }
    }

    parseInfo(info) {
        const lines = info.split('\n');
        const parsed = {};

        for (const line of lines) {
            if (line.includes(':')) {
                const [key, value] = line.split(':');
                parsed[key] = value;
            }
        }

        return parsed;
    }

    async getStats() {
        const info = await this.getInfo();
        return {
            connected: this.connected,
            used_memory: info.used_memory,
            connected_clients: info.connected_clients,
            uptime: info.uptime_in_seconds,
            keys: await this.getKeyCount()
        };
    }

    async getKeyCount(pattern = '*') {
        try {
            const keys = await this.keys(pattern);
            return keys.length;
        } catch (error) {
            return 0;
        }
    }
}

module.exports = RedisClient;
