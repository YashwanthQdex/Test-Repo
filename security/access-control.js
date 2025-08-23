class AccessControl {
    constructor() {
        this.users = new Map();
        this.roles = new Map();
        this.permissions = new Map();
        this.sessions = new Map();
        this.auditLog = [];
        this.passwordPolicy = {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: false
        };
    }

    createRole(roleData) {
        const role = {
            id: roleData.id || this.generateRoleId(),
            name: roleData.name,
            description: roleData.description,
            permissions: roleData.permissions || [],
            createdAt: new Date(),
            active: true
        };

        this.roles.set(role.id, role);
        this.logAuditEvent('role_created', null, { roleId: role.id, roleName: role.name });
        return role;
    }

    createUser(userData) {
        if (!this.validatePassword(userData.password)) {
            throw new Error('Password does not meet policy requirements');
        }

        const user = {
            id: userData.id || this.generateUserId(),
            username: userData.username,
            email: userData.email,
            passwordHash: this.hashPassword(userData.password),
            roles: userData.roles || [],
            active: true,
            lastLogin: null,
            failedLoginAttempts: 0,
            accountLocked: false,
            createdAt: new Date(),
            profile: {
                firstName: userData.firstName,
                lastName: userData.lastName,
                department: userData.department,
                phone: userData.phone
            }
        };

        this.users.set(user.id, user);
        this.logAuditEvent('user_created', user.id, { username: user.username, email: user.email });
        return user;
    }

    authenticateUser(username, password) {
        const user = Array.from(this.users.values())
            .find(u => u.username === username || u.email === username);

        if (!user) {
            this.logAuditEvent('login_failed', null, { username: username, reason: 'user_not_found' });
            return null;
        }

        if (user.accountLocked) {
            this.logAuditEvent('login_failed', user.id, { username: username, reason: 'account_locked' });
            return null;
        }

        if (!this.verifyPassword(password, user.passwordHash)) {
            user.failedLoginAttempts += 1;
            
            if (user.failedLoginAttempts >= 5) {
                user.accountLocked = true;
                this.logAuditEvent('account_locked', user.id, { username: username, attempts: user.failedLoginAttempts });
            }

            this.logAuditEvent('login_failed', user.id, { username: username, reason: 'invalid_password', attempts: user.failedLoginAttempts });
            return null;
        }

        user.failedLoginAttempts = 0;
        user.lastLogin = new Date();
        
        const session = this.createSession(user);
        this.logAuditEvent('login_success', user.id, { username: username, sessionId: session.id });
        
        return { user: user, session: session };
    }

    createSession(user) {
        const session = {
            id: this.generateSessionId(),
            userId: user.id,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
            ipAddress: null,
            userAgent: null,
            active: true
        };

        this.sessions.set(session.id, session);
        return session;
    }

    validateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (!session || !session.active) {
            return null;
        }

        if (session.expiresAt < new Date()) {
            session.active = false;
            this.logAuditEvent('session_expired', session.userId, { sessionId: sessionId });
            return null;
        }

        return session;
    }

    hasPermission(userId, permission, resource = null) {
        const user = this.users.get(userId);
        if (!user || !user.active) {
            return false;
        }

        // Check user roles for permissions
        for (const roleId of user.roles) {
            const role = this.roles.get(roleId);
            if (role && role.active && role.permissions.includes(permission)) {
                return true;
            }
        }

        // Check direct permissions (if implemented)
        return false;
    }

    assignRoleToUser(userId, roleId) {
        const user = this.users.get(userId);
        const role = this.roles.get(roleId);

        if (!user || !role) {
            return false;
        }

        if (!user.roles.includes(roleId)) {
            user.roles.push(roleId);
            this.logAuditEvent('role_assigned', userId, { roleId: roleId, roleName: role.name });
        }

        return true;
    }

    removeRoleFromUser(userId, roleId) {
        const user = this.users.get(userId);
        const role = this.roles.get(roleId);

        if (!user || !role) {
            return false;
        }

        const index = user.roles.indexOf(roleId);
        if (index > -1) {
            user.roles.splice(index, 1);
            this.logAuditEvent('role_removed', userId, { roleId: roleId, roleName: role.name });
        }

        return true;
    }

    addPermissionToRole(roleId, permission) {
        const role = this.roles.get(roleId);
        if (!role) {
            return false;
        }

        if (!role.permissions.includes(permission)) {
            role.permissions.push(permission);
            this.logAuditEvent('permission_added_to_role', null, { roleId: roleId, permission: permission });
        }

        return true;
    }

    removePermissionFromRole(roleId, permission) {
        const role = this.roles.get(roleId);
        if (!role) {
            return false;
        }

        const index = role.permissions.indexOf(permission);
        if (index > -1) {
            role.permissions.splice(index, 1);
            this.logAuditEvent('permission_removed_from_role', null, { roleId: roleId, permission: permission });
        }

        return true;
    }

    changePassword(userId, currentPassword, newPassword) {
        const user = this.users.get(userId);
        if (!user) {
            return false;
        }

        if (!this.verifyPassword(currentPassword, user.passwordHash)) {
            this.logAuditEvent('password_change_failed', userId, { reason: 'invalid_current_password' });
            return false;
        }

        if (!this.validatePassword(newPassword)) {
            return false;
        }

        user.passwordHash = this.hashPassword(newPassword);
        this.logAuditEvent('password_changed', userId, {});
        return true;
    }

    lockUser(userId, reason) {
        const user = this.users.get(userId);
        if (!user) {
            return false;
        }

        user.accountLocked = true;
        user.lockedAt = new Date();
        user.lockReason = reason;

        // Invalidate all user sessions
        for (const session of this.sessions.values()) {
            if (session.userId === userId) {
                session.active = false;
            }
        }

        this.logAuditEvent('user_locked', userId, { reason: reason });
        return true;
    }

    unlockUser(userId) {
        const user = this.users.get(userId);
        if (!user) {
            return false;
        }

        user.accountLocked = false;
        user.failedLoginAttempts = 0;
        delete user.lockedAt;
        delete user.lockReason;

        this.logAuditEvent('user_unlocked', userId, {});
        return true;
    }

    deactivateUser(userId) {
        const user = this.users.get(userId);
        if (!user) {
            return false;
        }

        user.active = false;
        user.deactivatedAt = new Date();

        // Invalidate all user sessions
        for (const session of this.sessions.values()) {
            if (session.userId === userId) {
                session.active = false;
            }
        }

        this.logAuditEvent('user_deactivated', userId, {});
        return true;
    }

    logout(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.active = false;
            this.logAuditEvent('logout', session.userId, { sessionId: sessionId });
            return true;
        }
        return false;
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

    hashPassword(password) {
        // Simple hash simulation - use proper hashing in production
        return `hashed_${password}_${Date.now()}`;
    }

    verifyPassword(password, hash) {
        // Simple verification simulation
        return hash.includes(password);
    }

    logAuditEvent(action, userId, details) {
        const event = {
            id: this.generateAuditId(),
            action: action,
            userId: userId,
            timestamp: new Date(),
            details: details,
            ipAddress: null, // Would be set from request
            userAgent: null  // Would be set from request
        };

        this.auditLog.push(event);
        
        // Keep only last 10000 events to prevent memory issues
        if (this.auditLog.length > 10000) {
            this.auditLog = this.auditLog.slice(-10000);
        }
    }

    getAuditLog(userId = null, action = null, limit = 100) {
        let filteredLog = this.auditLog;

        if (userId) {
            filteredLog = filteredLog.filter(event => event.userId === userId);
        }

        if (action) {
            filteredLog = filteredLog.filter(event => event.action === action);
        }

        return filteredLog
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    getActiveUsers() {
        return Array.from(this.users.values())
            .filter(user => user.active && !user.accountLocked);
    }

    getActiveSessions() {
        return Array.from(this.sessions.values())
            .filter(session => session.active && session.expiresAt > new Date());
    }

    generateUserId() {
        return `USER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateRoleId() {
        return `ROLE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateSessionId() {
        return `SESS_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
    }

    generateAuditId() {
        return `AUDIT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getUserStatistics() {
        const totalUsers = this.users.size;
        const activeUsers = Array.from(this.users.values()).filter(u => u.active).length;
        const lockedUsers = Array.from(this.users.values()).filter(u => u.accountLocked).length;
        const activeSessions = this.getActiveSessions().length;

        return {
            totalUsers,
            activeUsers,
            lockedUsers,
            activeSessions,
            totalRoles: this.roles.size,
            auditEvents: this.auditLog.length
        };
    }
}

module.exports = AccessControl;
