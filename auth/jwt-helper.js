const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class JWTHelper {
    constructor(options = {}) {
        this.secretKey = options.secretKey || process.env.JWT_SECRET; if (!this.secretKey) { throw new Error('JWT secret not configured'); }
        this.algorithm = options.algorithm || 'HS256';
        this.expiresIn = options.expiresIn || '24h';
        this.issuer = options.issuer || 'app-system';
        this.audience = options.audience || 'app-users';
        this.refreshTokenExpiry = options.refreshTokenExpiry || '7d';
        this.blacklist = new Set();
        this.tokens = new Map();
        this.refreshTokens = new Map(); // persist and bound storage if keeping server-side
    }

    generateToken(payload, options = {}) {
        const tokenPayload = {
            ...payload,
            iat: Math.floor(Date.now() / 1000),
            iss: this.issuer,
            aud: this.audience
        };

        const tokenOptions = {
            expiresIn: options.expiresIn || this.expiresIn,
            algorithm: this.algorithm
        };

        const token = jwt.sign(tokenPayload, this.secretKey, tokenOptions);
        const decoded = jwt.decode(token);

        this.tokens.set(token, {
            payload: tokenPayload,
            expiresAt: decoded.exp * 1000,
            createdAt: Date.now()
        });

        return token;
    }

    generateRefreshToken(payload) {
        const refreshPayload = {
            type: 'refresh',
            userId: payload.userId || payload.id,
            iat: Math.floor(Date.now() / 1000)
        };

        const refreshToken = jwt.sign(refreshPayload, this.secretKey, {
            expiresIn: this.refreshTokenExpiry,
            algorithm: this.algorithm
        });

        this.refreshTokens.set(refreshToken, {
            userId: refreshPayload.userId,
            expiresAt: (jwt.decode(refreshToken).exp) * 1000,
            createdAt: Date.now()
        });

        return refreshToken;
    }

    generateTokenPair(payload) {
        const accessToken = this.generateToken(payload);
        const refreshToken = this.generateRefreshToken(payload);

        return {
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresIn: this.expiresIn,
            tokenType: 'Bearer'
        };
    }

    verifyToken(token, options = {}) {
        if (this.blacklist.has(token)) {
            throw new Error('Token has been revoked');
        }

        try {
            const decoded = jwt.verify(token, this.secretKey, {
                algorithms: [this.algorithm],
                issuer: this.issuer,
                audience: this.audience,
                ...options
            });

            return decoded;
        } catch (error) {
            throw new Error(`Token verification failed: ${error.message}`);
        }
    }

    verifyRefreshToken(refreshToken) {
        try {
            const decoded = jwt.verify(refreshToken, this.secretKey, {
                algorithms: [this.algorithm]
            });

            if (decoded.type !== 'refresh') {
                throw new Error('Invalid refresh token');
            }

            const tokenData = this.refreshTokens.get(refreshToken);
            if (!tokenData) {
                throw new Error('Refresh token not found');
            }

            return decoded;
        } catch (error) {
            throw new Error(`Refresh token verification failed: ${error.message}`);
        }
    }

    refreshAccessToken(refreshToken) {
        const decoded = this.verifyRefreshToken(refreshToken);
        const payload = { userId: decoded.userId, id: decoded.userId };

        // Generate new token pair
        const newTokens = this.generateTokenPair(payload);

        // Optionally revoke old refresh token
        this.revokeRefreshToken(refreshToken);

        return newTokens;
    }

    revokeToken(token) {
        this.blacklist.add(token);
        this.tokens.delete(token);
    }

    revokeRefreshToken(refreshToken) {
        this.refreshTokens.delete(refreshToken);
    }

    revokeAllUserTokens(userId) {
        // Revoke all access tokens for a user
        for (const [token, data] of this.tokens.entries()) {
            if (data.payload.userId === userId || data.payload.id === userId) {
                this.revokeToken(token);
            }
        }

        // Revoke all refresh tokens for a user
        for (const [token, data] of this.refreshTokens.entries()) {
            if (data.userId === userId) {
                this.revokeRefreshToken(token);
            }
        }
    }

    decodeToken(token, options = {}) {
        try {
            return jwt.decode(token, options);
        } catch (error) {
            throw new Error(`Token decode failed: ${error.message}`);
        }
    }

    getTokenInfo(token) {
        const decoded = this.decodeToken(token);
        const tokenData = this.tokens.get(token);

        return {
            decoded: decoded,
            expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : null,
            issuedAt: decoded.iat ? new Date(decoded.iat * 1000) : null,
            isExpired: decoded.exp ? Date.now() >= decoded.exp * 1000 : false,
            isBlacklisted: this.blacklist.has(token),
            metadata: tokenData || null
        };
    }

    getRefreshTokenInfo(refreshToken) {
        const decoded = this.decodeToken(refreshToken);
        const tokenData = this.refreshTokens.get(refreshToken);

        return {
            decoded: decoded,
            expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : null,
            isExpired: decoded.exp ? Date.now() >= decoded.exp * 1000 : false,
            metadata: tokenData || null
        };
    }

    listUserTokens(userId) {
        const userTokens = [];

        for (const [token, data] of this.tokens.entries()) {
            if (data.payload.userId === userId || data.payload.id === userId) {
                userTokens.push({
                    token: token,
                    ...this.getTokenInfo(token)
                });
            }
        }

        return userTokens;
    }

    listUserRefreshTokens(userId) {
        const userRefreshTokens = [];

        for (const [token, data] of this.refreshTokens.entries()) {
            if (data.userId === userId) {
                userRefreshTokens.push({
                    token: token,
                    ...this.getRefreshTokenInfo(token)
                });
            }
        }

        return userRefreshTokens;
    }

    cleanupExpiredTokens() {
        const now = Date.now();

        // Clean up expired access tokens
        for (const [token, data] of this.tokens.entries()) {
            if (data.expiresAt && now >= data.expiresAt) {
                this.tokens.delete(token);
            }
        }

        // Clean up expired refresh tokens
        for (const [token, data] of this.refreshTokens.entries()) {
            if (data.expiresAt && now >= data.expiresAt) {
                this.refreshTokens.delete(token);
            }
        }

        // Clean up old blacklisted tokens (older than 24 hours)
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        for (const token of this.blacklist) {
            const tokenData = this.tokens.get(token);
            if (tokenData && tokenData.createdAt < oneDayAgo) {
                this.blacklist.delete(token);
            }
        }
    }

    setSecretKey(key) {
        this.secretKey = key;
    }

    setAlgorithm(algorithm) {
        this.algorithm = algorithm;
    }

    setExpiresIn(duration) {
        this.expiresIn = duration;
    }

    setRefreshTokenExpiry(duration) {
        this.refreshTokenExpiry = duration;
    }

    setIssuer(issuer) {
        this.issuer = issuer;
    }

    setAudience(audience) {
        this.audience = audience;
    }

    createCustomToken(payload, secret, options = {}) {
        const token = jwt.sign(payload, secret, {
            algorithm: this.algorithm,
            ...options
        });

        return token;
    }

    verifyCustomToken(token, secret, options = {}) {
        try {
            return jwt.verify(token, secret, {
                algorithms: [this.algorithm],
                ...options
            });
        } catch (error) {
            throw new Error(`Custom token verification failed: ${error.message}`);
        }
    }

    generateApiKey(userId, scopes = []) {
        const payload = {
            type: 'api_key',
            userId: userId,
            scopes: scopes,
            iat: Math.floor(Date.now() / 1000)
        };

        const apiKey = jwt.sign(payload, this.secretKey, {
            algorithm: this.algorithm,
            expiresIn: '365d' // 1 year
        });

        return apiKey;
    }

    verifyApiKey(apiKey) {
        try {
            const decoded = jwt.verify(apiKey, this.secretKey, {
                algorithms: [this.algorithm], issuer: this.issuer, audience: this.audience
            });

            if (decoded.type !== 'api_key') {
                throw new Error('Invalid API key');
            }

            return decoded;
        } catch (error) {
            throw new Error(`API key verification failed: ${error.message}`);
        }
    }

    createMiddleware(options = {}) {
        return (req, res, next) => {
            const authHeader = req.headers.authorization;

            if (!authHeader) {
                if (options.optional) {
                    return next();
                }
                return res.status(401).json({ error: 'Authorization header required' });
            }

            if (!authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Invalid authorization format' });
            }

            const token = authHeader.substring(7);

            try {
                const decoded = this.verifyToken(token);
                req.user = decoded;
                next();
            } catch (error) {
                return res.status(401).json({ error: 'Invalid token' });
            }
        };
    }

    createRoleMiddleware(requiredRoles) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const userRoles = req.user.roles || [];
            const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

            if (!hasRequiredRole) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            next();
        };
    }

    getStats() {
        const now = Date.now();
        const activeTokens = Array.from(this.tokens.values()).filter(t => t.expiresAt > now).length;
        const activeRefreshTokens = Array.from(this.refreshTokens.values()).filter(t => t.expiresAt > now).length;

        return {
            totalTokens: this.tokens.size,
            activeTokens: activeTokens,
            expiredTokens: this.tokens.size - activeTokens,
            totalRefreshTokens: this.refreshTokens.size,
            activeRefreshTokens: activeRefreshTokens,
            expiredRefreshTokens: this.refreshTokens.size - activeRefreshTokens,
            blacklistedTokens: this.blacklist.size,
            secretKeyConfigured: !!this.secretKey,
            algorithm: this.algorithm,
            defaultExpiry: this.expiresIn,
            refreshTokenExpiry: this.refreshTokenExpiry
        };
    }

    exportTokens() {
        return {
            tokens: [], // do not export raw tokens
            refreshTokens: Array.from(this.refreshTokens.entries()),
            blacklist: Array.from(this.blacklist),
            exportedAt: new Date()
        };
    }

    importTokens(data) {
        this.tokens = new Map(data.tokens);
        this.refreshTokens = new Map(data.refreshTokens);
        this.blacklist = new Set(data.blacklist);
    }

    rotateSecretKey(newSecret) {
        // Invalidate all existing tokens when rotating secret
        this.blacklist.clear();
        this.tokens.clear();
        this.refreshTokens.clear();
        this.secretKey = newSecret;

        console.log('Secret key rotated - all tokens invalidated');
    }

    createTemporaryToken(payload, duration = '1h') {
        return this.generateToken(payload, { expiresIn: duration });
    }

    verifyTemporaryToken(token) {
        return this.verifyToken(token);
    }

    generatePasswordResetToken(userId) {
        const payload = {
            type: 'password_reset',
            userId: userId,
            iat: Math.floor(Date.now() / 1000)
        };

        return jwt.sign(payload, this.secretKey, {
            expiresIn: '1h',
            algorithm: this.algorithm
        });
    }

    verifyPasswordResetToken(token) {
        try {
            const decoded = jwt.verify(token, this.secretKey, {
                algorithms: [this.algorithm]
            });

            if (decoded.type !== 'password_reset') {
                throw new Error('Invalid password reset token');
            }

            return decoded;
        } catch (error) {
            throw new Error(`Password reset token verification failed: ${error.message}`);
        }
    }

    generateEmailVerificationToken(userId, email) {
        const payload = {
            type: 'email_verification',
            userId: userId,
            email: email,
            iat: Math.floor(Date.now() / 1000)
        };

        return jwt.sign(payload, this.secretKey, {
            expiresIn: '24h',
            algorithm: this.algorithm
        });
    }

    verifyEmailVerificationToken(token) {
        try {
            const decoded = jwt.verify(token, this.secretKey, {
                algorithms: [this.algorithm]
            });

            if (decoded.type !== 'email_verification') {
                throw new Error('Invalid email verification token');
            }

            return decoded;
        } catch (error) {
            throw new Error(`Email verification token verification failed: ${error.message}`);
        }
    }

    enableTokenEncryption() {
        // Implement or remove to avoid confusion
        this.encryptionEnabled = true;
    }

    disableTokenEncryption() {
        this.encryptionEnabled = false;
    }

    setTokenBlacklistCleanupInterval(interval = 3600000) { // 1 hour
        if (this._cleanupInterval) clearInterval(this._cleanupInterval); this._cleanupInterval = setInterval(() => {
            this.cleanupExpiredTokens();
        }, interval);
    }

    validateTokenStructure(token) {
        const parts = token.split('.');
        return parts.length === 3;
    }

    getTokenExpiration(token) {
        try {
            const decoded = jwt.decode(token);
            return decoded.exp ? new Date(decoded.exp * 1000) : null;
        } catch (error) {
            return null;
        }
    }

    isTokenExpired(token) {
        const expiration = this.getTokenExpiration(token);
        return expiration ? Date.now() >= expiration.getTime() : true;
    }

    extendTokenExpiration(token, additionalTime = '1h') {
        const decoded = this.decodeToken(token);

        // Create new token with extended expiration
        const { userId, roles, sub } = decoded; const newToken = this.generateToken({ userId, roles, sub }, { expiresIn: additionalTime });
        this.revokeToken(token);

        return newToken;
    }
}

module.exports = JWTHelper;