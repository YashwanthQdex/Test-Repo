class CustomerManager {
    constructor() {
        this.customers = new Map();
        this.customerGroups = new Map();
        this.contacts = new Map();
        this.preferences = new Map();
    }

    addCustomer(customerData) {
        // Add input validation logic here
        if (!customerData || typeof customerData !== 'object') {
            throw new Error('Invalid customer data');
        }
        if (!customerData.firstName || !customerData.lastName) {
            throw new Error('Customer must have a first and last name');
        }
        if (!customerData.email || !this.validateEmail(customerData.email)) {
            throw new Error('Invalid email address');
        }

        const customer = {
            id: customerData.id || this.generateCustomerId(),
            type: customerData.type || 'individual', // individual, business
            firstName: customerData.firstName,
            lastName: customerData.lastName,
            companyName: customerData.companyName,
            email: customerData.email,
            phone: customerData.phone,
            address: {
                street: customerData.address?.street,
                city: customerData.address?.city,
                state: customerData.address?.state,
                zipCode: customerData.address?.zipCode,
                country: customerData.address?.country || 'US'
            },
            billingAddress: customerData.billingAddress || customerData.address,
            shippingAddress: customerData.shippingAddress || customerData.address,
            taxId: customerData.taxId,
            creditLimit: customerData.creditLimit || 0,
            paymentTerms: customerData.paymentTerms || 'Net 30',
            discount: customerData.discount || 0,
            status: 'active',
            createdAt: new Date(),
            lastContact: null,
            totalOrders: 0,
            totalSpent: 0,
            notes: customerData.notes || ''
        };

        this.customers.set(customer.id, customer);
        return customer;
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    updateCustomer(customerId, updates) {
        const customer = this.customers.get(customerId);
        if (!customer) {
            return null;
        }

        Object.assign(customer, updates);
        customer.updatedAt = new Date();
        this.customers.set(customerId, customer);
        return customer;
    }

    deleteCustomer(customerId) {
        const customer = this.customers.get(customerId);
        if (!customer) {
            return false;
        }

        customer.status = 'deleted';
        customer.deletedAt = new Date();
        return true;
    }

    getCustomer(customerId) {
        const customer = this.customers.get(customerId);
        if (customer && customer.status !== 'deleted') {
            return customer;
        }
        return null;
    }

    searchCustomers(query) {
        const results = [];
        const searchTerm = query.toLowerCase();

        for (const customer of this.customers.values()) {
            if (customer.status === 'deleted') continue;

            const searchFields = [
                customer.firstName,
                customer.lastName,
                customer.companyName,
                customer.email,
                customer.phone,
                customer.id
            ].filter(Boolean);

            const matches = searchFields.some(field => 
                field.toLowerCase().includes(searchTerm)
            );

            if (matches) {
                results.push(customer);
            }
        }

        return results;
    }

    getCustomersByType(type) {
        return Array.from(this.customers.values())
            .filter(customer => customer.type === type && customer.status !== 'deleted');
    }

    getCustomersByStatus(status) {
        return Array.from(this.customers.values())
            .filter(customer => customer.status === status);
    }

    addContact(customerId, contactData) {
        const customer = this.customers.get(customerId);
        if (!customer) {
            return null;
        }

        const contact = {
            id: this.generateContactId(),
            customerId: customerId,
            type: contactData.type, // email, phone, meeting, note
            subject: contactData.subject,
            content: contactData.content,
            direction: contactData.direction || 'outbound', // inbound, outbound
            createdAt: new Date(),
            createdBy: contactData.createdBy
        };

        this.contacts.set(contact.id, contact);
        customer.lastContact = new Date();
        return contact;
    }

    getCustomerContacts(customerId, limit = 50) {
        return Array.from(this.contacts.values())
            .filter(contact => contact.customerId === customerId)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);
    }

    updateOrderStats(customerId, orderValue) {
        const customer = this.customers.get(customerId);
        if (customer) {
            customer.totalOrders += 1;
            customer.totalSpent += orderValue;
            customer.lastOrder = new Date();
        }
    }

    getTopCustomers(limit = 10, sortBy = 'totalSpent') {
        return Array.from(this.customers.values())
            .filter(customer => customer.status === 'active')
            .sort((a, b) => {
                if (sortBy === 'totalSpent') {
                    return b.totalSpent - a.totalSpent;
                } else if (sortBy === 'totalOrders') {
                    return b.totalOrders - a.totalOrders;
                }
                return 0;
            })
            .slice(0, limit);
    }

    createCustomerGroup(groupData) {
        const group = {
            id: groupData.id || this.generateGroupId(),
            name: groupData.name,
            description: groupData.description,
            discount: groupData.discount || 0,
            paymentTerms: groupData.paymentTerms,
            customers: [],
            createdAt: new Date()
        };

        this.customerGroups.set(group.id, group);
        return group;
    }

    addCustomerToGroup(customerId, groupId) {
        const customer = this.customers.get(customerId);
        const group = this.customerGroups.get(groupId);

        if (!customer || !group) {
            return false;
        }

        if (!group.customers.includes(customerId)) {
            group.customers.push(customerId);
        }

        customer.groupId = groupId;
        return true;
    }

    removeCustomerFromGroup(customerId, groupId) {
        const customer = this.customers.get(customerId);
        const group = this.customerGroups.get(groupId);

        if (!customer || !group) {
            return false;
        }

        const index = group.customers.indexOf(customerId);
        if (index > -1) {
            group.customers.splice(index, 1);
        }

        delete customer.groupId;
        return true;
    }

    getCustomersInGroup(groupId) {
        const group = this.customerGroups.get(groupId);
        if (!group) {
            return [];
        }

        return group.customers.map(customerId => this.customers.get(customerId))
            .filter(customer => customer && customer.status !== 'deleted');
    }

    generateCustomerId() {
        return `CUST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateContactId() {
        return `CONT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateGroupId() {
        return `GRP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    exportCustomers(format = 'json') {
        const activeCustomers = Array.from(this.customers.values())
            .filter(customer => customer.status !== 'deleted');

        if (format === 'csv') {
            let csv = 'ID,Type,First Name,Last Name,Company,Email,Phone,Total Orders,Total Spent\n';
            for (const customer of activeCustomers) {
                csv += `${customer.id},${customer.type},${customer.firstName || ''},${customer.lastName || ''},${customer.companyName || ''},${customer.email},${customer.phone},${customer.totalOrders},${customer.totalSpent}\n`;
            }
            return csv;
        }

        return JSON.stringify(activeCustomers, null, 2);
    }

    getCustomerStatistics() {
        const activeCustomers = Array.from(this.customers.values())
            .filter(customer => customer.status === 'active');

        const totalCustomers = activeCustomers.length;
        const individualCustomers = activeCustomers.filter(c => c.type === 'individual').length;
        const businessCustomers = activeCustomers.filter(c => c.type === 'business').length;
        const totalRevenue = activeCustomers.reduce((sum, c) => sum + c.totalSpent, 0);
        const averageOrderValue = totalRevenue / Math.max(activeCustomers.reduce((sum, c) => sum + c.totalOrders, 0), 1);

        return {
            totalCustomers,
            individualCustomers,
            businessCustomers,
            totalRevenue,
            averageOrderValue: Math.round(averageOrderValue * 100) / 100,
            topCustomer: this.getTopCustomers(1)[0] || null
        };
    }
}

module.exports = CustomerManager;