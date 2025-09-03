const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class UserManagement extends EventEmitter {
    constructor(options = {}) {
        super();
        this.users = new Map();
        this.roles = new Map();
        this.permissions = new Map();
        this.groups = new Map();
        this.sessions = new Map();
        this.profiles = new Map();
        this.authTokens = new Map();
        this.passwordResets = new Map();
        this.userActivity = [];
        this.auditLog = [];
        this.loginAttempts = new Map();
        this.twoFactorSecrets = new Map();
        this.socialLogins = new Map();
        this.userPreferences = new Map();
        this.notifications = new Map();
        this.metrics = {
            totalUsers: 0,
            activeUsers: 0,
            totalSessions: 0,
            failedLogins: 0,
            passwordResets: 0,
            accountCreations: 0
        };

        this.passwordPolicy = options.passwordPolicy || {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: false,
            maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
        };

        this.sessionConfig = options.sessionConfig || {
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            maxSessionsPerUser: 5,
            extendOnActivity: true
        };

        this.enableAudit = options.enableAudit !== false;
        this.enableTwoFactor = options.enableTwoFactor || false;
        this.enableSocialLogin = options.enableSocialLogin || false;
        this.maxLoginAttempts = options.maxLoginAttempts || 5;
        this.lockoutDuration = options.lockoutDuration || 15 * 60 * 1000; // 15 minutes
    }

    // User Creation and Registration
    async createUser(userData) {
        // Validate input
        this.validateUserData(userData);

        const userId = userData.id || this.generateUserId();
        const hashedPassword = await this.hashPassword(userData.password);

        const user = {
            id: userId,
            username: userData.username,
            email: userData.email,
            passwordHash: hashedPassword,
            firstName: userData.firstName,
            lastName: userData.lastName,
            status: 'pending', // pending, active, inactive, suspended, deleted
            emailVerified: false,
            twoFactorEnabled: false,
            roles: userData.roles || ['user'],
            groups: userData.groups || [],
            permissions: new Set(),
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLogin: null,
            loginCount: 0,
            failedLoginAttempts: 0,
            accountLocked: false,
            lockoutUntil: null,
            passwordChangedAt: new Date(),
            metadata: userData.metadata || {}
        };

        this.users.set(userId, user);
        this.metrics.totalUsers++;

        // Create user profile
        this.createUserProfile(userId, userData);

        // Assign default permissions
        await this.assignRolePermissions(user);

        this.audit('user_created', userId, { email: user.email, roles: user.roles });
        this.emit('user:created', user);

        return user;
    }

    validateUserData(userData) {
        if (!userData.username || userData.username.length < 3) {
            throw new Error('Username must be at least 3 characters long');
        }

        if (!userData.email || !this.isValidEmail(userData.email)) {
            throw new Error('Valid email is required');
        }

        if (!userData.password || !this.validatePassword(userData.password)) {
            throw new Error('Password does not meet policy requirements');
        }

        // Check for existing users
        if (this.findUserByUsername(userData.username)) {
            throw new Error('Username already exists');
        }

        if (this.findUserByEmail(userData.email)) {
            throw new Error('Email already exists');
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validatePassword(password) {
        const policy = this.passwordPolicy;

        if (password.length < policy.minLength) {
            return false;
        }

        if (policy.requireUppercase && !/[A-Z]/.test(password)) {
            return false;
        }

        if (policy.requireLowercase && !/[a-z]/.test(password)) {
            return false;
        }

        if (policy.requireNumbers && !/\d/.test(password)) {
            return false;
        }

        if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return false;
        }

        return true;
    }

    async hashPassword(password) {
        return new Promise((resolve, reject) => {
            const salt = crypto.randomBytes(16).toString('hex');
            crypto.scrypt(password, salt, 64, (err, derivedKey) => {
                if (err) reject(err);
                resolve(salt + ':' + derivedKey.toString('hex'));
            });
        });
    }

    async verifyPassword(password, hash) {
        return new Promise((resolve, reject) => {
            const [salt, key] = hash.split(':');
            crypto.scrypt(password, salt, 64, (err, derivedKey) => {
                if (err) reject(err);
                resolve(key === derivedKey.toString('hex'));
            });
        });
    }

    createUserProfile(userId, userData) {
        const profile = {
            userId: userId,
            avatar: userData.avatar || null,
            bio: userData.bio || '',
            location: userData.location || '',
            website: userData.website || '',
            phone: userData.phone || '',
            dateOfBirth: userData.dateOfBirth || null,
            gender: userData.gender || '',
            timezone: userData.timezone || 'UTC',
            language: userData.language || 'en',
            preferences: {
                emailNotifications: true,
                smsNotifications: false,
                marketingEmails: false,
                theme: 'light',
                dateFormat: 'MM/DD/YYYY',
                timeFormat: '12h'
            },
            socialLinks: userData.socialLinks || {},
            customFields: userData.customFields || {}
        };

        this.profiles.set(userId, profile);
        return profile;
    }

    // Authentication
    async authenticateUser(usernameOrEmail, password) {
        const user = this.findUserByUsername(usernameOrEmail) ||
                    this.findUserByEmail(usernameOrEmail);

        if (!user) {
            this.recordFailedLogin(usernameOrEmail);
            throw new Error('Invalid credentials');
        }

        // Check account status
        if (user.status !== 'active') {
            throw new Error('Account is not active');
        }

        // Check account lockout
        if (this.isAccountLocked(user)) {
            throw new Error('Account is temporarily locked due to too many failed attempts');
        }

        // Verify password
        const isValidPassword = await this.verifyPassword(password, user.passwordHash);
        if (!isValidPassword) {
            this.recordFailedLogin(user.id);
            throw new Error('Invalid credentials');
        }

        // Check two-factor authentication
        if (user.twoFactorEnabled && !this.verifyTwoFactor(user.id, password)) {
            throw new Error('Two-factor authentication required');
        }

        // Reset failed attempts and create session
        user.failedLoginAttempts = 0;
        user.accountLocked = false;
        user.lockoutUntil = null;
        user.lastLogin = new Date();
        user.loginCount++;

        const session = this.createSession(user);
        this.recordUserActivity(user.id, 'login', { sessionId: session.id });

        this.audit('user_login', user.id, { ip: 'unknown', userAgent: 'unknown' });
        this.emit('user:login', user, session);

        return { user, session };
    }

    recordFailedLogin(userId) {
        if (!this.loginAttempts.has(userId)) {
            this.loginAttempts.set(userId, []);
        }

        const attempts = this.loginAttempts.get(userId);
        attempts.push(new Date());

        // Keep only last 10 attempts
        if (attempts.length > 10) {
            attempts.shift();
        }

        const user = this.users.get(userId);
        if (user) {
            user.failedLoginAttempts = attempts.length;

            if (user.failedLoginAttempts >= this.maxLoginAttempts) {
                user.accountLocked = true;
                user.lockoutUntil = new Date(Date.now() + this.lockoutDuration);
                this.audit('account_locked', userId, { attempts: user.failedLoginAttempts });
            }
        }

        this.metrics.failedLogins++;
    }

    isAccountLocked(user) {
        if (!user.accountLocked) {
            return false;
        }

        if (user.lockoutUntil && user.lockoutUntil < new Date()) {
            // Lockout period has expired
            user.accountLocked = false;
            user.lockoutUntil = null;
            user.failedLoginAttempts = 0;
            return false;
        }

        return true;
    }

    createSession(user) {
        // Clean up old sessions for this user
        this.cleanupUserSessions(user.id);

        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            userId: user.id,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + this.sessionConfig.maxAge),
            ipAddress: null,
            userAgent: null,
            active: true,
            metadata: {}
        };

        this.sessions.set(sessionId, session);
        this.metrics.totalSessions++;

        return session;
    }

    validateSession(sessionId) {
        const session = this.sessions.get(sessionId);

        if (!session || !session.active) {
            return null;
        }

        if (session.expiresAt < new Date()) {
            session.active = false;
            this.audit('session_expired', session.userId, { sessionId });
            return null;
        }

        // Extend session if configured
        if (this.sessionConfig.extendOnActivity) {
            session.expiresAt = new Date(Date.now() + this.sessionConfig.maxAge);
        }

        return session;
    }

    destroySession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.active = false;
            this.audit('session_destroyed', session.userId, { sessionId });
            this.emit('session:destroyed', session);
        }
    }

    cleanupUserSessions(userId) {
        const userSessions = Array.from(this.sessions.values())
            .filter(session => session.userId === userId);

        // Keep only the most recent sessions up to the limit
        const activeSessions = userSessions
            .filter(session => session.active)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, this.sessionConfig.maxSessionsPerUser);

        // Deactivate excess sessions
        for (const session of userSessions) {
            if (!activeSessions.includes(session)) {
                session.active = false;
            }
        }
    }

    // Password Management
    async changePassword(userId, currentPassword, newPassword) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Verify current password
        const isValidCurrentPassword = await this.verifyPassword(currentPassword, user.passwordHash);
        if (!isValidCurrentPassword) {
            throw new Error('Current password is incorrect');
        }

        // Validate new password
        if (!this.validatePassword(newPassword)) {
            throw new Error('New password does not meet policy requirements');
        }

        // Hash new password
        user.passwordHash = await this.hashPassword(newPassword);
        user.passwordChangedAt = new Date();

        this.audit('password_changed', userId, {});
        this.emit('user:password_changed', user);

        return true;
    }

    async initiatePasswordReset(email) {
        const user = this.findUserByEmail(email);
        if (!user) {
            // Don't reveal if email exists or not for security
            return true;
        }

        const resetToken = this.generateResetToken();
        const resetRequest = {
            token: resetToken,
            userId: user.id,
            email: email,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            used: false
        };

        this.passwordResets.set(resetToken, resetRequest);
        this.metrics.passwordResets++;

        // In a real system, send email with reset link
        this.audit('password_reset_initiated', user.id, { email });
        this.emit('password:reset_initiated', resetRequest);

        return resetToken;
    }

    async resetPassword(token, newPassword) {
        const resetRequest = this.passwordResets.get(token);
        if (!resetRequest || resetRequest.used) {
            throw new Error('Invalid or expired reset token');
        }

        if (resetRequest.expiresAt < new Date()) {
            throw new Error('Reset token has expired');
        }

        const user = this.users.get(resetRequest.userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Validate new password
        if (!this.validatePassword(newPassword)) {
            throw new Error('Password does not meet policy requirements');
        }

        // Update password
        user.passwordHash = await this.hashPassword(newPassword);
        user.passwordChangedAt = new Date();

        // Mark token as used
        resetRequest.used = true;
        resetRequest.usedAt = new Date();

        this.audit('password_reset_completed', user.id, {});
        this.emit('password:reset_completed', user);

        return true;
    }

    // Two-Factor Authentication
    setupTwoFactor(userId) {
        if (!this.enableTwoFactor) {
            throw new Error('Two-factor authentication is not enabled');
        }

        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const secret = crypto.randomBytes(32).toString('hex');
        this.twoFactorSecrets.set(userId, {
            secret: secret,
            createdAt: new Date(),
            enabled: false
        });

        // Generate QR code URL (mock)
        const qrCodeUrl = `otpauth://totp/${user.email}?secret=${secret}&issuer=UserManagement`;

        return { secret, qrCodeUrl };
    }

    verifyTwoFactorSetup(userId, token) {
        const secretData = this.twoFactorSecrets.get(userId);
        if (!secretData) {
            throw new Error('Two-factor setup not initiated');
        }

        const isValid = this.verifyTOTP(token, secretData.secret);
        if (isValid) {
            secretData.enabled = true;
            const user = this.users.get(userId);
            user.twoFactorEnabled = true;
            this.audit('2fa_enabled', userId, {});
        }

        return isValid;
    }

    verifyTwoFactor(userId, token) {
        const secretData = this.twoFactorSecrets.get(userId);
        if (!secretData || !secretData.enabled) {
            return false;
        }

        return this.verifyTOTP(token, secretData.secret);
    }

    verifyTOTP(token, secret) {
        // Simple TOTP verification (in production, use a proper TOTP library)
        const timeWindow = Math.floor(Date.now() / 30000); // 30-second windows
        const validTokens = [];

        // Check current and adjacent time windows
        for (let i = -1; i <= 1; i++) {
            const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'hex'));
            hmac.update(Buffer.from((timeWindow + i).toString()));
            const hash = hmac.digest();

            const offset = hash[hash.length - 1] & 0xf;
            const code = ((hash[offset] & 0x7f) << 24) |
                        ((hash[offset + 1] & 0xff) << 16) |
                        ((hash[offset + 2] & 0xff) << 8) |
                        (hash[offset + 3] & 0xff);

            validTokens.push((code % 1000000).toString().padStart(6, '0'));
        }

        return validTokens.includes(token);
    }

    disableTwoFactor(userId) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }

        user.twoFactorEnabled = false;
        this.twoFactorSecrets.delete(userId);
        this.audit('2fa_disabled', userId, {});
    }

    // Role and Permission Management
    createRole(roleData) {
        const roleId = roleData.id || this.generateRoleId();
        const role = {
            id: roleId,
            name: roleData.name,
            description: roleData.description,
            permissions: new Set(roleData.permissions || []),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.roles.set(roleId, role);
        return role;
    }

    assignRoleToUser(userId, roleId) {
        const user = this.users.get(userId);
        const role = this.roles.get(roleId);

        if (!user || !role) {
            throw new Error('User or role not found');
        }

        if (!user.roles.includes(roleId)) {
            user.roles.push(roleId);
            this.assignRolePermissions(user);
            this.audit('role_assigned', userId, { roleId, roleName: role.name });
        }

        return true;
    }

    removeRoleFromUser(userId, roleId) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const index = user.roles.indexOf(roleId);
        if (index > -1) {
            user.roles.splice(index, 1);
            this.assignRolePermissions(user);
            this.audit('role_removed', userId, { roleId });
        }

        return true;
    }

    async assignRolePermissions(user) {
        user.permissions.clear();

        for (const roleId of user.roles) {
            const role = this.roles.get(roleId);
            if (role) {
                for (const permission of role.permissions) {
                    user.permissions.add(permission);
                }
            }
        }
    }

    hasPermission(userId, permission) {
        const user = this.users.get(userId);
        if (!user) {
            return false;
        }

        return user.permissions.has(permission);
    }

    createPermission(permissionData) {
        const permissionId = permissionData.id || this.generatePermissionId();
        const permission = {
            id: permissionId,
            name: permissionData.name,
            description: permissionData.description,
            resource: permissionData.resource,
            action: permissionData.action,
            createdAt: new Date()
        };

        this.permissions.set(permissionId, permission);
        return permission;
    }

    // Group Management
    createGroup(groupData) {
        const groupId = groupData.id || this.generateGroupId();
        const group = {
            id: groupId,
            name: groupData.name,
            description: groupData.description,
            members: new Set(),
            permissions: new Set(groupData.permissions || []),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.groups.set(groupId, group);
        return group;
    }

    addUserToGroup(userId, groupId) {
        const user = this.users.get(userId);
        const group = this.groups.get(groupId);

        if (!user || !group) {
            throw new Error('User or group not found');
        }

        group.members.add(userId);
        user.groups.push(groupId);

        // Add group permissions to user
        for (const permission of group.permissions) {
            user.permissions.add(permission);
        }

        this.audit('user_added_to_group', userId, { groupId, groupName: group.name });
        return true;
    }

    removeUserFromGroup(userId, groupId) {
        const user = this.users.get(userId);
        const group = this.groups.get(groupId);

        if (!user || !group) {
            return false;
        }

        group.members.delete(userId);
        const index = user.groups.indexOf(groupId);
        if (index > -1) {
            user.groups.splice(index, 1);
            this.assignRolePermissions(user); // Recalculate permissions
        }

        this.audit('user_removed_from_group', userId, { groupId });
        return true;
    }

    // User Activity and Audit
    recordUserActivity(userId, action, details = {}) {
        const activity = {
            id: this.generateActivityId(),
            userId: userId,
            action: action,
            details: details,
            timestamp: new Date(),
            ipAddress: details.ipAddress || 'unknown',
            userAgent: details.userAgent || 'unknown'
        };

        this.userActivity.push(activity);

        // Keep only last 10000 activities
        if (this.userActivity.length > 10000) {
            this.userActivity = this.userActivity.slice(-10000);
        }

        this.emit('user:activity', activity);
    }

    getUserActivity(userId, limit = 50) {
        return this.userActivity
            .filter(activity => activity.userId === userId)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    audit(action, userId, details = {}) {
        if (!this.enableAudit) return;

        const auditEntry = {
            id: this.generateAuditId(),
            action: action,
            userId: userId,
            details: details,
            timestamp: new Date(),
            ipAddress: details.ipAddress || 'unknown'
        };

        this.auditLog.push(auditEntry);

        // Keep only last 50000 audit entries
        if (this.auditLog.length > 50000) {
            this.auditLog = this.auditLog.slice(-50000);
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

    // Social Login Integration
    setupSocialLogin(provider, config) {
        if (!this.enableSocialLogin) {
            throw new Error('Social login is not enabled');
        }

        this.socialLogins.set(provider, {
            provider: provider,
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            redirectUri: config.redirectUri,
            scope: config.scope || ['email', 'profile'],
            enabled: true
        });
    }

    async authenticateWithSocial(provider, authCode) {
        const socialConfig = this.socialLogins.get(provider);
        if (!socialConfig) {
            throw new Error(`Social provider '${provider}' not configured`);
        }

        // Mock social authentication
        const socialUser = {
            id: `social_${provider}_${Date.now()}`,
            email: `user_${Date.now()}@social.${provider}`,
            name: `Social User ${Date.now()}`,
            provider: provider,
            providerId: authCode,
            profile: {
                avatar: `https://api.${provider}.com/avatar/${authCode}`,
                verified: true
            }
        };

        // Check if user already exists
        let user = this.findUserByEmail(socialUser.email);

        if (!user) {
            // Create new user
            user = await this.createUser({
                username: socialUser.email.split('@')[0],
                email: socialUser.email,
                firstName: socialUser.name.split(' ')[0],
                lastName: socialUser.name.split(' ').slice(1).join(' '),
                password: this.generateSocialPassword(),
                metadata: {
                    socialLogin: {
                        provider: provider,
                        providerId: socialUser.id,
                        profile: socialUser.profile
                    }
                }
            });
        }

        // Create session
        const session = this.createSession(user);
        this.recordUserActivity(user.id, 'social_login', { provider });

        return { user, session };
    }

    generateSocialPassword() {
        return crypto.randomBytes(32).toString('hex');
    }

    // User Preferences
    updateUserPreferences(userId, preferences) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const profile = this.profiles.get(userId);
        if (profile) {
            Object.assign(profile.preferences, preferences);
            profile.updatedAt = new Date();
        }

        this.userPreferences.set(userId, {
            ...preferences,
            updatedAt: new Date()
        });

        this.audit('preferences_updated', userId, { preferences });
        return true;
    }

    getUserPreferences(userId) {
        const profile = this.profiles.get(userId);
        return profile ? profile.preferences : {};
    }

    // Notifications
    sendNotification(userId, notificationData) {
        const notification = {
            id: this.generateNotificationId(),
            userId: userId,
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            data: notificationData.data || {},
            read: false,
            createdAt: new Date()
        };

        if (!this.notifications.has(userId)) {
            this.notifications.set(userId, []);
        }

        this.notifications.get(userId).push(notification);
        this.emit('notification:sent', notification);

        return notification;
    }

    getUserNotifications(userId, limit = 20) {
        const userNotifications = this.notifications.get(userId) || [];
        return userNotifications
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);
    }

    markNotificationRead(userId, notificationId) {
        const userNotifications = this.notifications.get(userId);
        if (!userNotifications) return false;

        const notification = userNotifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            notification.readAt = new Date();
            return true;
        }

        return false;
    }

    // Account Management
    suspendUser(userId, reason) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }

        user.status = 'suspended';
        user.suspendedAt = new Date();
        user.suspensionReason = reason;

        // Destroy all sessions
        this.destroyUserSessions(userId);

        this.audit('user_suspended', userId, { reason });
        this.emit('user:suspended', user);

        return true;
    }

    reactivateUser(userId) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }

        user.status = 'active';
        user.reactivatedAt = new Date();
        delete user.suspendedAt;
        delete user.suspensionReason;

        this.audit('user_reactivated', userId, {});
        this.emit('user:reactivated', user);

        return true;
    }

    deleteUser(userId, reason) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }

        user.status = 'deleted';
        user.deletedAt = new Date();
        user.deletionReason = reason;

        // Clean up related data
        this.destroyUserSessions(userId);
        this.profiles.delete(userId);
        this.twoFactorSecrets.delete(userId);
        this.userPreferences.delete(userId);
        this.notifications.delete(userId);

        this.audit('user_deleted', userId, { reason });
        this.emit('user:deleted', user);

        return true;
    }

    destroyUserSessions(userId) {
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.userId === userId) {
                this.destroySession(sessionId);
            }
        }
    }

    // Utility Methods
    findUserByUsername(username) {
        for (const user of this.users.values()) {
            if (user.username === username) {
                return user;
            }
        }
        return null;
    }

    findUserByEmail(email) {
        for (const user of this.users.values()) {
            if (user.email === email) {
                return user;
            }
        }
        return null;
    }

    getUser(userId) {
        return this.users.get(userId);
    }

    listUsers(filters = {}) {
        let users = Array.from(this.users.values());

        if (filters.status) {
            users = users.filter(user => user.status === filters.status);
        }

        if (filters.role) {
            users = users.filter(user => user.roles.includes(filters.role));
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            users = users.filter(user =>
                user.username.toLowerCase().includes(searchTerm) ||
                user.email.toLowerCase().includes(searchTerm) ||
                user.firstName.toLowerCase().includes(searchTerm) ||
                user.lastName.toLowerCase().includes(searchTerm)
            );
        }

        return users;
    }

    // ID Generators
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateSessionId() {
        return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateResetToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    generateRoleId() {
        return `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generatePermissionId() {
        return `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateGroupId() {
        return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateActivityId() {
        return `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateAuditId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateNotificationId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Metrics and Analytics
    getMetrics() {
        const activeUsers = Array.from(this.users.values())
            .filter(user => user.status === 'active').length;

        const totalSessions = Array.from(this.sessions.values())
            .filter(session => session.active).length;

        const userStatusCounts = {};
        for (const user of this.users.values()) {
            userStatusCounts[user.status] = (userStatusCounts[user.status] || 0) + 1;
        }

        return {
            ...this.metrics,
            activeUsers,
            totalSessions,
            userStatusCounts
        };
    }

    // Export/Import
    exportUsers() {
        return {
            users: Array.from(this.users.entries()),
            profiles: Array.from(this.profiles.entries()),
            roles: Array.from(this.roles.entries()),
            permissions: Array.from(this.permissions.entries()),
            groups: Array.from(this.groups.entries()),
            exportedAt: new Date()
        };
    }

    importUsers(data) {
        // Clear existing data
        this.users.clear();
        this.profiles.clear();
        this.roles.clear();
        this.permissions.clear();
        this.groups.clear();

        // Import data
        for (const [id, user] of data.users) {
            this.users.set(id, user);
        }

        for (const [id, profile] of data.profiles) {
            this.profiles.set(id, profile);
        }

        for (const [id, role] of data.roles) {
            this.roles.set(id, role);
        }

        for (const [id, permission] of data.permissions) {
            this.permissions.set(id, permission);
        }

        for (const [id, group] of data.groups) {
            this.groups.set(id, group);
        }

        return true;
    }

    // Cleanup
    cleanup() {
        // Remove expired sessions
        const now = new Date();
        for (const [sessionId, session] of this.sessions.entries()) {
            if (!session.active || session.expiresAt < now) {
                this.sessions.delete(sessionId);
            }
        }

        // Remove expired password resets
        for (const [token, reset] of this.passwordResets.entries()) {
            if (reset.expiresAt < now || reset.used) {
                this.passwordResets.delete(token);
            }
        }

        // Remove old user activity (older than 90 days)
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        this.userActivity = this.userActivity.filter(activity => activity.timestamp >= cutoff);

        // Archive old audit logs
        if (this.auditLog.length > 25000) {
            this.auditLog = this.auditLog.slice(-25000);
        }
    }

    // Real-time features
    enableRealTime() {
        this.realTimeEnabled = true;
        return this;
    }

    subscribeToUserEvents(userId, callback) {
        const listener = (event, data) => {
            if (data.userId === userId || data.id === userId) {
                callback(event, data);
            }
        };

        this.on('user:created', listener);
        this.on('user:login', listener);
        this.on('user:activity', listener);

        return () => {
            this.off('user:created', listener);
            this.off('user:login', listener);
            this.off('user:activity', listener);
        };
    }

    // Admin features
    getSystemHealth() {
        const metrics = this.getMetrics();
        const activeSessions = Array.from(this.sessions.values())
            .filter(session => session.active).length;

        const health = {
            status: 'healthy',
            checks: {
                users: {
                    status: metrics.totalUsers > 0 ? 'healthy' : 'warning',
                    count: metrics.totalUsers,
                    active: metrics.activeUsers
                },
                sessions: {
                    status: activeSessions < 1000 ? 'healthy' : 'warning',
                    count: activeSessions
                },
                failedLogins: {
                    status: metrics.failedLogins < 100 ? 'healthy' : 'warning',
                    count: metrics.failedLogins
                }
            }
        };

        // Determine overall health
        const unhealthyChecks = Object.values(health.checks)
            .filter(check => check.status !== 'healthy');

        if (unhealthyChecks.length > 0) {
            health.status = 'warning';
        }

        return health;
    }

    // Bulk operations
    async bulkCreateUsers(usersData) {
        const results = [];

        for (const userData of usersData) {
            try {
                const user = await this.createUser(userData);
                results.push({ success: true, user: user });
            } catch (error) {
                results.push({ success: false, error: error.message, data: userData });
            }
        }

        return results;
    }

    bulkUpdateUsers(updates) {
        const results = [];

        for (const update of updates) {
            try {
                const user = this.users.get(update.userId);
                if (user) {
                    Object.assign(user, update.data);
                    user.updatedAt = new Date();
                    results.push({ success: true, user: user });
                } else {
                    results.push({ success: false, error: 'User not found', userId: update.userId });
                }
            } catch (error) {
                results.push({ success: false, error: error.message, userId: update.userId });
            }
        }

        return results;
    }

    // Destroy
    destroy() {
        this.users.clear();
        this.roles.clear();
        this.permissions.clear();
        this.groups.clear();
        this.sessions.clear();
        this.profiles.clear();
        this.authTokens.clear();
        this.passwordResets.clear();
        this.userActivity = [];
        this.auditLog = [];
        this.loginAttempts.clear();
        this.twoFactorSecrets.clear();
        this.socialLogins.clear();
        this.userPreferences.clear();
        this.notifications.clear();
        this.removeAllListeners();
    }
}

module.exports = UserManagement;
