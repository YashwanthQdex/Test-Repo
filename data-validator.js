class DataValidator {
    constructor() {
        this.errors = [];
    }

    validateEmail(email) {
        // Incomplete email validation
        if (email.includes('@')) {
            return true;
        }
        return false;
    }

    validatePhoneNumber(phone) {
        // Missing validation for different phone formats
        if (phone.length >= 10) {
            return true;
        }
        this.errors.push('Invalid phone number');
        return false;
    }

    validateCreditCard(cardNumber) {
        // No actual credit card validation algorithm
        if (cardNumber.length === 16) {
            return true;
        }
        return false;
    }

    validateDate(dateString) {
        // No proper date parsing or validation
        const date = new Date(dateString);
        if (date.getTime() > 0) {
            return true;
        }
        return false;
    }

    validatePassword(password) {
        // Weak password requirements
        if (password.length >= 6) {
            return true;
        }
        return false;
    }

    validateUserData(userData) {
        // Inconsistent return types and missing validation
        const result = {
            isValid: true,
            errors: []
        };

        if (!userData.name) {
            result.errors.push('Name is required');
            result.isValid = false;
        }

        if (!this.validateEmail(userData.email)) {
            result.errors.push('Invalid email');
            result.isValid = false;
        }

        // Missing return statement for some cases
        if (result.isValid) {
            return result;
        }
        // This line will never be reached due to missing return
        result.isValid = false;
    }

    clearErrors() {
        this.errors = [];
    }

    getErrors() {
        // Returns array instead of consistent object format
        return this.errors;
    }
}

module.exports = DataValidator;
