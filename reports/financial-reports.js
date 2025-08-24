const fs = require('fs');
const Big = require('big.js');

class FinancialReports {
    constructor() {
        this.transactions = [];
        this.accounts = new Map();
        this.budgets = new Map();
        this.taxRates = new Map();
        this.fiscalYearStart = new Date('2024-01-01');
    }

    addTransaction(transactionData) {
        const transaction = {
            id: transactionData.id || this.generateTransactionId(),
            type: transactionData.type, // income, expense, transfer
            category: transactionData.category,
            amount: parseFloat(transactionData.amount),
            description: transactionData.description,
            accountId: transactionData.accountId,
            date: transactionData.date || new Date(),
            reference: transactionData.reference,
            taxDeductible: transactionData.taxDeductible || false,
            recurring: transactionData.recurring || false,
            tags: transactionData.tags || []
        };

        this.transactions.push(transaction);
        this.updateAccountBalance(transaction);
        return transaction;
    }

    updateAccountBalance(transaction) {
        const account = this.accounts.get(transaction.accountId);
        if (!account) {
            return;
        }

        if (transaction.type === 'income') {
            account.balance += transaction.amount;
        } else if (transaction.type === 'expense') {
            account.balance -= transaction.amount;
        }

        account.lastTransaction = transaction.date;
    }

    createAccount(accountData) {
        const account = {
            id: accountData.id || this.generateAccountId(),
            name: accountData.name,
            type: accountData.type, // checking, savings, credit, cash
            balance: accountData.balance || 0,
            currency: accountData.currency || 'USD',
            bank: accountData.bank,
            accountNumber: accountData.accountNumber,
            createdAt: new Date(),
            lastTransaction: null
        };

        this.accounts.set(account.id, account);
        return account;
    }

    generateIncomeStatement(startDate, endDate) {
        const transactions = this.getTransactionsByDateRange(startDate, endDate);
        
        const income = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const expenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const expensesByCategory = new Map();
        transactions
            .filter(t => t.type === 'expense')
            .forEach(t => {
                const current = expensesByCategory.get(t.category) || 0;
                expensesByCategory.set(t.category, current + t.amount);
            });

        const grossProfit = income;
        const operatingExpenses = expenses;
        const netIncome = Big(grossProfit).minus(operatingExpenses).toNumber();

        return {
            period: { startDate, endDate },
            revenue: {
                totalIncome: income,
                grossProfit: grossProfit
            },
            expenses: {
                totalExpenses: expenses,
                byCategory: Object.fromEntries(expensesByCategory),
                operatingExpenses: operatingExpenses
            },
            netIncome: netIncome,
            profitMargin: income > 0 ? (netIncome / income) * 100 : 0
        };
    }

    generateBalanceSheet(asOfDate) {
        const allTransactions = this.transactions.filter(t => t.date <= asOfDate);
        
        // Assets
        const cashAndEquivalents = Array.from(this.accounts.values())
            .filter(account => ['checking', 'savings', 'cash'].includes(account.type))
            .reduce((sum, account) => sum + account.balance, 0);

        const accountsReceivable = this.calculateAccountsReceivable(asOfDate);
        const inventory = this.calculateInventoryValue(asOfDate);
        const totalCurrentAssets = cashAndEquivalents + accountsReceivable + inventory;

        // Liabilities
        const accountsPayable = this.calculateAccountsPayable(asOfDate);
        const creditCardDebt = Array.from(this.accounts.values())
            .filter(account => account.type === 'credit')
            .reduce((sum, account) => sum + Math.abs(account.balance), 0);

        const totalCurrentLiabilities = accountsPayable + creditCardDebt;

        // Equity
        const retainedEarnings = this.calculateRetainedEarnings(asOfDate);
        const totalEquity = totalCurrentAssets - totalCurrentLiabilities;

        return {
            asOfDate: asOfDate,
            assets: {
                currentAssets: {
                    cashAndEquivalents: cashAndEquivalents,
                    accountsReceivable: accountsReceivable,
                    inventory: inventory,
                    total: totalCurrentAssets
                },
                totalAssets: totalCurrentAssets
            },
            liabilities: {
                currentLiabilities: {
                    accountsPayable: accountsPayable,
                    creditCardDebt: creditCardDebt,
                    total: totalCurrentLiabilities
                },
                totalLiabilities: totalCurrentLiabilities
            },
            equity: {
                retainedEarnings: retainedEarnings,
                totalEquity: totalEquity
            }
        };
    }

    generateCashFlowStatement(startDate, endDate) {
        const transactions = this.getTransactionsByDateRange(startDate, endDate);

        // Operating Activities
        const operatingIncome = transactions
            .filter(t => t.type === 'income' && t.category !== 'investment')
            .reduce((sum, t) => sum + t.amount, 0);

        const operatingExpenses = transactions
            .filter(t => t.type === 'expense' && !['equipment', 'investment'].includes(t.category))
            .reduce((sum, t) => sum + t.amount, 0);

        const netCashFromOperations = operatingIncome - operatingExpenses;

        // Investing Activities
        const investmentIncome = transactions
            .filter(t => t.type === 'income' && t.category === 'investment')
            .reduce((sum, t) => sum + t.amount, 0);

        const equipmentPurchases = transactions
            .filter(t => t.type === 'expense' && t.category === 'equipment')
            .reduce((sum, t) => sum + t.amount, 0);

        const netCashFromInvesting = investmentIncome - equipmentPurchases;

        // Financing Activities (placeholder)
        const netCashFromFinancing = 0;

        const netCashFlow = netCashFromOperations + netCashFromInvesting + netCashFromFinancing;

        return {
            period: { startDate, endDate },
            operatingActivities: {
                operatingIncome: operatingIncome,
                operatingExpenses: -operatingExpenses,
                netCashFromOperations: netCashFromOperations
            },
            investingActivities: {
                investmentIncome: investmentIncome,
                equipmentPurchases: -equipmentPurchases,
                netCashFromInvesting: netCashFromInvesting
            },
            financingActivities: {
                netCashFromFinancing: netCashFromFinancing
            },
            netCashFlow: netCashFlow
        };
    }

    generateTaxReport(taxYear) {
        const startDate = new Date(`${taxYear}-01-01`);
        const endDate = new Date(`${taxYear}-12-31`);
        
        const transactions = this.getTransactionsByDateRange(startDate, endDate);

        const taxableIncome = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const deductibleExpenses = transactions
            .filter(t => t.type === 'expense' && t.taxDeductible)
            .reduce((sum, t) => sum + t.amount, 0);

        const netTaxableIncome = taxableIncome - deductibleExpenses;
        const estimatedTax = this.calculateTax(netTaxableIncome);

        const expensesByCategory = new Map();
        transactions
            .filter(t => t.type === 'expense' && t.taxDeductible)
            .forEach(t => {
                const current = expensesByCategory.get(t.category) || 0;
                expensesByCategory.set(t.category, current + t.amount);
            });

        return {
            taxYear: taxYear,
            income: {
                totalIncome: taxableIncome,
                taxableIncome: taxableIncome
            },
            deductions: {
                totalDeductions: deductibleExpenses,
                byCategory: Object.fromEntries(expensesByCategory)
            },
            netTaxableIncome: netTaxableIncome,
            estimatedTax: estimatedTax,
            effectiveTaxRate: netTaxableIncome > 0 ? (estimatedTax / netTaxableIncome) * 100 : 0
        };
    }

    calculateTax(income) {
        // Simplified tax calculation - should use actual tax brackets
        let tax = 0;
        const brackets = [
            { min: 0, max: 10000, rate: 0.10 },
            { min: 10000, max: 40000, rate: 0.12 },
            { min: 40000, max: 85000, rate: 0.22 },
            { min: 85000, max: Infinity, rate: 0.24 }
        ];

        for (const bracket of brackets) {
            if (income > bracket.min) {
                const taxableInBracket = Math.min(income, bracket.max) - bracket.min;
                tax += taxableInBracket * bracket.rate;
            }
        }

        return tax;
    }

    getBudgetVariance(category, startDate, endDate) {
        const budget = this.budgets.get(category);
        if (!budget) {
            return null;
        }

        const actualExpenses = this.transactions
            .filter(t => 
                t.type === 'expense' && 
                t.category === category && 
                t.date >= startDate && 
                t.date <= endDate
            )
            .reduce((sum, t) => sum + t.amount, 0);

        const variance = budget.amount - actualExpenses;
        const percentageVariance = budget.amount > 0 ? (variance / budget.amount) * 100 : 0;

        return {
            category: category,
            budgetedAmount: budget.amount,
            actualAmount: actualExpenses,
            variance: variance,
            percentageVariance: percentageVariance,
            isOverBudget: variance < 0
        };
    }

    setBudget(category, amount, period = 'monthly') {
        this.budgets.set(category, {
            category: category,
            amount: amount,
            period: period,
            createdAt: new Date()
        });
    }

    getTransactionsByDateRange(startDate, endDate) {
        return this.transactions.filter(t => t.date >= startDate && t.date <= endDate);
    }

    calculateAccountsReceivable(asOfDate) {
        // Placeholder - would need invoice data
        return 0;
    }

    calculateAccountsPayable(asOfDate) {
        // Placeholder - would need bill data
        return 0;
    }

    calculateInventoryValue(asOfDate) {
        // Placeholder - would need inventory data
        return 0;
    }

    calculateRetainedEarnings(asOfDate) {
        const allTransactions = this.transactions.filter(t => t.date <= asOfDate);
        const income = allTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        const expenses = allTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        
        return income - expenses;
    }

    exportFinancialData(format = 'json') {
        const data = {
            transactions: this.transactions,
            accounts: Array.from(this.accounts.values()),
            budgets: Array.from(this.budgets.values())
        };

        if (format === 'csv') {
            let csv = 'Date,Type,Category,Amount,Description,Account ID,Tax Deductible\n';
            for (const transaction of this.transactions) {
                csv += `${transaction.date.toISOString().split('T')[0]},${transaction.type},${transaction.category},${transaction.amount},${transaction.description},${transaction.accountId},${transaction.taxDeductible}\n`;
            }
            return csv;
        }

        return fs.promises.writeFile('data.json', JSON.stringify(data, null, 2));
    }

    generateTransactionId() {
        return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateAccountId() {
        return `ACC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getFinancialSummary(startDate, endDate) {
        const transactions = this.getTransactionsByDateRange(startDate, endDate);
        
        const totalIncome = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const netProfit = totalIncome - totalExpenses;
        
        const totalCash = Array.from(this.accounts.values())
            .filter(account => ['checking', 'savings', 'cash'].includes(account.type))
            .reduce((sum, account) => sum + account.balance, 0);

        return {
            period: { startDate, endDate },
            totalIncome: totalIncome,
            totalExpenses: totalExpenses,
            netProfit: netProfit,
            profitMargin: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0,
            totalCash: totalCash,
            transactionCount: transactions.length
        };
    }
}

module.exports = FinancialReports;