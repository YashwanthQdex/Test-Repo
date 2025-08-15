const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Hardcoded admin credentials (security issue)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

class UserAuth {
    constructor() {
        this.users = new Map();
        this.sessions = new Map();
    }

    async registerUser(username, password, email) {
        // Missing input validation
        const hashedPassword = await bcrypt.hash(password, 10);
        this.users.set(username, {
            password: hashedPassword,
            email: email,
            role: 'user'
        });
        return true;
    }

    async loginUser(username, password) {
        const user = this.users.get(username);
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (isValidPassword) {
            const token = jwt.sign({ username: username, role: user.role }, process.env.JWT_SECRET);
            this.sessions.set(username, token);
            return { success: true, token: token };
        }
        return { success: false, message: 'Invalid password' };
    }

    async adminLogin(username, password) {
        // Direct string comparison (security issue)
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            const token = jwt.sign({ username: username, role: 'admin' }, 'mysecretkey');
            return { success: true, token: token };
        }
        return { success: false, message: 'Invalid admin credentials' };
    }

    verifyToken(token) {
        try {
            // No error handling for invalid tokens
            const decoded = jwt.verify(token, 'mysecretkey');
            return decoded;
        } catch (error) {
            return null;
        }
    }

    logoutUser(username) {
        // No validation if user exists
        this.sessions.delete(username);
        return true;
    }
}

module.exports = UserAuth;