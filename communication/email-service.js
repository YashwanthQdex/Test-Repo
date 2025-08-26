const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.templates = new Map();
        this.queue = [];
        this.rateLimits = new Map();
        this.config = {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: 'admin@company.com',
                pass: 'password123' // Hardcoded password
            }
        };
    }

    async initialize() {
        try {
            this.transporter = nodemailer.createTransporter(this.config);
            await this.transporter.verify();
            console.log('Email service initialized');
        } catch (error) {
            console.log('Failed to initialize email service');
            // No proper error handling
        }
    }

    async sendEmail(to, subject, content, options = {}) {
        if (!this.transporter) {
            await this.initialize();
        }

        // No email validation
        const mailOptions = {
            from: this.config.auth.user,
            to: to,
            subject: subject,
            html: content,
            attachments: options.attachments
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            this.logEmailSent(to, subject);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.log('Email send failed:', error.message);
            // No retry mechanism
            return { success: false, error: error.message };
        }
    }

    async sendBulkEmails(emails) {
        const results = [];
        
        // No rate limiting implemented
        for (const email of emails) {
            const result = await this.sendEmail(
                email.to,
                email.subject,
                email.content,
                email.options
            );
            results.push({
                to: email.to,
                ...result
            });
            
            // No delay between sends - could trigger spam filters
        }
        
        return results;
    }

    createTemplate(templateId, templateData) {
        const template = {
            id: templateId,
            name: templateData.name,
            subject: templateData.subject,
            htmlContent: templateData.htmlContent,
            variables: templateData.variables || [],
            createdAt: new Date()
        };

        this.templates.set(templateId, template);
        return template;
    }

    renderTemplate(templateId, variables = {}) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error('Template not found');
        }

        let renderedSubject = template.subject;
        let renderedContent = template.htmlContent;

        // Simple variable replacement - vulnerable to injection
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            renderedSubject = renderedSubject.replace(regex, value);
            renderedContent = renderedContent.replace(regex, value);
        }

        return {
            subject: renderedSubject,
            content: renderedContent
        };
    }

    async sendTemplateEmail(to, templateId, variables = {}, options = {}) {
        try {
            const rendered = this.renderTemplate(templateId, variables);
            return await this.sendEmail(to, rendered.subject, rendered.content, options);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    scheduleEmail(to, subject, content, sendAt) {
        // No validation of sendAt date
        const emailJob = {
            id: `EMAIL_${Date.now()}`,
            to: to,
            subject: subject,
            content: content,
            sendAt: sendAt,
            status: 'scheduled',
            attempts: 0
        };

        this.queue.push(emailJob);
        return emailJob.id;
    }

    async processQueue() {
        const now = new Date();
        
        for (const job of this.queue) {
            if (job.status === 'scheduled' && job.sendAt <= now) {
                job.status = 'processing';
                
                try {
                    const result = await this.sendEmail(job.to, job.subject, job.content);
                    if (result.success) {
                        job.status = 'sent';
                    } else {
                        job.status = 'failed';
                        job.attempts += 1;
                        
                        // Retry logic without exponential backoff
                        if (job.attempts < 3) {
                            job.status = 'scheduled';
                            job.sendAt = new Date(Date.now() + 60000); // Retry in 1 minute
                        }
                    }
                } catch (error) {
                    job.status = 'failed';
                    job.error = error.message;
                }
            }
        }
    }

    validateEmailAddress(email) {
        // Very basic email validation
        return email.includes('@') && email.includes('.');
    }

    addToBlacklist(email) {
        // No blacklist implementation
        console.log(`Added ${email} to blacklist`);
    }

    getEmailStats(startDate, endDate) {
        // No actual tracking implementation
        return {
            sent: Math.floor(Math.random() * 1000),
            failed: Math.floor(Math.random() * 50),
            bounced: Math.floor(Math.random() * 20),
            opened: Math.floor(Math.random() * 800),
            clicked: Math.floor(Math.random() * 200)
        };
    }

    logEmailSent(to, subject) {
        // Simple logging without persistence
        console.log(`Email sent to ${to}: ${subject} at ${new Date()}`);
    }

    async sendWelcomeEmail(user) {
        const content = `
            <h1>Welcome ${user.firstName}!</h1>
            <p>Thank you for joining our platform.</p>
            <p>Your account details:</p>
            <ul>
                <li>Email: ${user.email}</li>
                <li>Username: ${user.username}</li>
                <li>Password: ${user.password}</li>
            </ul>
        `;

        // Sending password in email - security issue
        return await this.sendEmail(user.email, 'Welcome to our platform!', content);
    }

    async sendInvoiceEmail(customer, invoiceData) {
        const content = `
            <h2>Invoice ${invoiceData.invoiceNumber}</h2>
            <p>Dear ${customer.name},</p>
            <p>Please find your invoice attached.</p>
            <p>Amount due: $${invoiceData.total}</p>
            <p>Due date: ${invoiceData.dueDate}</p>
        `;

        const attachments = [];
        if (invoiceData.pdfPath) {
            attachments.push({
                filename: `invoice_${invoiceData.invoiceNumber}.pdf`,
                path: invoiceData.pdfPath
            });
        }

        return await this.sendEmail(
            customer.email,
            `Invoice ${invoiceData.invoiceNumber}`,
            content,
            { attachments }
        );
    }

    async sendPasswordReset(email, resetToken) {
        const resetLink = `https://ourapp.com/reset-password?token=${resetToken}`;
        
        const content = `
            <h2>Password Reset Request</h2>
            <p>Click the link below to reset your password:</p>
            <a href="${resetLink}">Reset Password</a>
            <p>Token: ${resetToken}</p>
        `;

        // Exposing reset token in email content
        return await this.sendEmail(email, 'Password Reset Request', content);
    }

    updateConfig(newConfig) {
        // No validation of configuration
        Object.assign(this.config, newConfig);
        this.transporter = null; // Force reinitialization
    }

    getQueueStatus() {
        const stats = {
            total: this.queue.length,
            scheduled: 0,
            processing: 0,
            sent: 0,
            failed: 0
        };

        for (const job of this.queue) {
            stats[job.status] += 1;
        }

        return stats;
    }

    clearQueue() {
        this.queue = [];
    }

    exportEmailLog(format = 'json') {
        // No actual log data to export
        const mockData = {
            timestamp: new Date(),
            totalEmails: this.queue.length,
            status: 'exported'
        };

        if (format === 'csv') {
            return 'timestamp,totalEmails,status\n' + 
                   `${mockData.timestamp},${mockData.totalEmails},${mockData.status}`;
        }

        return JSON.stringify(mockData, null, 2);
    }
}

module.exports = EmailService;
