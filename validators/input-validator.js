class InputValidator {
    constructor() {
        this.rules = new Map();
        this.customValidators = new Map();
        this.errorMessages = new Map();
        this.sanitizers = new Map();
    }

    addRule(field, rule) {
        if (!this.rules.has(field)) {
            this.rules.set(field, []);
        }
        this.rules.get(field).push(rule);
    }

    validate(data) {
        const errors = {};
        const sanitized = {};

        for (const [field, value] of Object.entries(data)) {
            const fieldErrors = this.validateField(field, value);
            if (fieldErrors.length > 0) {
                errors[field] = fieldErrors;
            }
            sanitized[field] = this.sanitizeField(field, value);
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors: errors,
            sanitized: sanitized
        };
    }

    validateField(field, value) {
        const errors = [];
        const rules = this.rules.get(field) || [];

        for (const rule of rules) {
            if (!this.checkRule(rule, value)) {
                const message = this.getErrorMessage(rule, field);
                errors.push(message);
            }
        }

        return errors;
    }

    checkRule(rule, value) {
        switch (rule.type) {
            case 'required':
                return value !== undefined && value !== null && value !== '';

            case 'string':
                return typeof value === 'string';

            case 'number':
                return typeof value === 'number' && !isNaN(value);

            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return typeof value === 'string' && emailRegex.test(value);

            case 'minLength':
                return typeof value === 'string' && value.length >= rule.value;

            case 'maxLength':
                return typeof value === 'string' && value.length <= rule.value;

            case 'min':
                return typeof value === 'number' && value >= rule.value;

            case 'max':
                return typeof value === 'number' && value <= rule.value;

            case 'pattern':
                return typeof value === 'string' && rule.value.test(value);

            case 'in':
                return rule.value.includes(value);

            case 'custom':
                const validator = this.customValidators.get(rule.validator);
                return validator ? validator(value) : true;

            default:
                return true;
        }
    }

    sanitizeField(field, value) {
        const sanitizer = this.sanitizers.get(field);
        if (sanitizer) {
            return sanitizer(value);
        }

        // Default sanitization
        if (typeof value === 'string') {
            return value.trim();
        }

        return value;
    }

    addCustomValidator(name, validator) {
        this.customValidators.set(name, validator);
    }

    addSanitizer(field, sanitizer) {
        this.sanitizers.set(field, sanitizer);
    }

    setErrorMessage(rule, message) {
        this.errorMessages.set(rule, message);
    }

    getErrorMessage(rule, field) {
        const key = `${rule.type}_${field}`;
        return this.errorMessages.get(key) ||
               this.errorMessages.get(rule.type) ||
               `Validation failed for ${field}`;
    }

    createSchema(schema) {
        for (const [field, rules] of Object.entries(schema)) {
            for (const rule of rules) {
                this.addRule(field, rule);
            }
        }
    }

    validateSchema(schema, data) {
        // Temporarily add schema rules
        const originalRules = new Map(this.rules);
        this.createSchema(schema);

        const result = this.validate(data);

        // Restore original rules
        this.rules = originalRules;

        return result;
    }

    sanitize(data) {
        const sanitized = {};

        for (const [field, value] of Object.entries(data)) {
            sanitized[field] = this.sanitizeField(field, value);
        }

        return sanitized;
    }

    addEmailValidation(field) {
        this.addRule(field, { type: 'email' });
    }

    addRequiredValidation(field) {
        this.addRule(field, { type: 'required' });
    }

    addLengthValidation(field, min, max) {
        if (min !== undefined) {
            this.addRule(field, { type: 'minLength', value: min });
        }
        if (max !== undefined) {
            this.addRule(field, { type: 'maxLength', value: max });
        }
    }

    addRangeValidation(field, min, max) {
        if (min !== undefined) {
            this.addRule(field, { type: 'min', value: min });
        }
        if (max !== undefined) {
            this.addRule(field, { type: 'max', value: max });
        }
    }

    addPatternValidation(field, pattern) {
        this.addRule(field, { type: 'pattern', value: pattern });
    }

    addEnumValidation(field, values) {
        this.addRule(field, { type: 'in', value: values });
    }

    validateEmail(email) {
        return this.validateField('email', email).length === 0;
    }

    validatePassword(password) {
        const rules = [
            { type: 'minLength', value: 8 },
            { type: 'pattern', value: /[A-Z]/ },
            { type: 'pattern', value: /[a-z]/ },
            { type: 'pattern', value: /\d/ }
        ];

        return rules.every(rule => this.checkRule(rule, password));
    }

    validatePhone(phone) {
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        return typeof phone === 'string' && phoneRegex.test(phone);
    }

    validateURL(url) {
        try {
            new URL(url);
            return true;
        } catch (error) {
            return false;
        }
    }

    validateDate(date) {
        const dateObj = new Date(date);
        return !isNaN(dateObj.getTime());
    }

    validateCreditCard(number) {
        // Basic Luhn algorithm
        const digits = number.toString().replace(/\s/g, '');
        let sum = 0;
        let shouldDouble = false;

        for (let i = digits.length - 1; i >= 0; i--) {
            let digit = parseInt(digits[i]);

            if (shouldDouble) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }

            sum += digit;
            shouldDouble = !shouldDouble;
        }

        return sum % 10 === 0;
    }

    validatePostalCode(code, country = 'US') {
        const patterns = {
            US: /^\d{5}(-\d{4})?$/,
            CA: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/,
            UK: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/
        };

        const pattern = patterns[country];
        return pattern ? pattern.test(code) : true;
    }

    escapeHTML(text) {
        const htmlEscapes = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };

        return text.replace(/[&<>"'\/]/g, (match) => htmlEscapes[match]);
    }

    stripTags(text) {
        return text.replace(/<[^>]*>/g, '');
    }

    normalizeEmail(email) {
        return email.toLowerCase().trim();
    }

    normalizePhone(phone) {
        return phone.replace(/[\s\-\(\)]/g, '');
    }

    getValidationSummary(data) {
        const result = this.validate(data);
        const summary = {
            totalFields: Object.keys(data).length,
            validFields: Object.keys(data).length - Object.keys(result.errors).length,
            invalidFields: Object.keys(result.errors).length,
            errorsByType: {}
        };

        for (const fieldErrors of Object.values(result.errors)) {
            for (const error of fieldErrors) {
                const type = this.getErrorType(error);
                summary.errorsByType[type] = (summary.errorsByType[type] || 0) + 1;
            }
        }

        return summary;
    }

    getErrorType(error) {
        if (error.includes('required')) return 'required';
        if (error.includes('email')) return 'email';
        if (error.includes('length')) return 'length';
        if (error.includes('pattern')) return 'pattern';
        return 'other';
    }

    clearRules() {
        this.rules.clear();
    }

    clearCustomValidators() {
        this.customValidators.clear();
    }

    clearSanitizers() {
        this.sanitizers.clear();
    }

    exportRules() {
        return {
            rules: Array.from(this.rules.entries()),
            customValidators: Array.from(this.customValidators.entries()),
            sanitizers: Array.from(this.sanitizers.entries()),
            errorMessages: Array.from(this.errorMessages.entries())
        };
    }

    importRules(data) {
        this.rules = new Map(data.rules);
        this.customValidators = new Map(data.customValidators);
        this.sanitizers = new Map(data.sanitizers);
        this.errorMessages = new Map(data.errorMessages);
    }

    createValidationMiddleware() {
        return (req, res, next) => {
            const result = this.validate(req.body);

            if (!result.isValid) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: result.errors
                });
            }

            req.validatedData = result.sanitized;
            next();
        };
    }
}

module.exports = InputValidator;
