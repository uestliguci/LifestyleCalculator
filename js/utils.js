import { DATE_FORMATS } from './config.js';

/**
 * Formats a date object or date string according to the specified format
 * @param {Date|string} date - Date to format
 * @param {string} format - Format type from DATE_FORMATS
 * @returns {string} Formatted date string
 */
export function formatDate(date, format = DATE_FORMATS.display.date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    
    return format
        .replace('YYYY', year)
        .replace('MM', (month + 1).toString().padStart(2, '0'))
        .replace('MMM', monthNames[month].substring(0, 3))
        .replace('MMMM', monthNames[month])
        .replace('DD', day.toString().padStart(2, '0'))
        .replace('hh', (hours % 12 || 12).toString().padStart(2, '0'))
        .replace('HH', hours.toString().padStart(2, '0'))
        .replace('mm', minutes.toString().padStart(2, '0'))
        .replace('A', hours >= 12 ? 'PM' : 'AM');
}

/**
 * Formats a number as currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount) {
    return `${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount)} Lek`;
}

/**
 * Generates a unique ID for transactions
 * @returns {string} Unique ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Groups transactions by a specific time period
 * @param {Array} transactions - Array of transactions
 * @param {string} period - Time period ('day', 'week', 'month')
 * @returns {Object} Grouped transactions
 */
export function groupTransactionsByPeriod(transactions, period) {
    return transactions.reduce((groups, transaction) => {
        const date = new Date(transaction.date);
        let key;

        switch (period) {
            case 'day':
                key = formatDate(date, DATE_FORMATS.storage.date);
                break;
            case 'week':
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = formatDate(weekStart, DATE_FORMATS.storage.date);
                break;
            case 'month':
                key = formatDate(date, DATE_FORMATS.storage.month);
                break;
            default:
                key = formatDate(date, DATE_FORMATS.storage.date);
        }

        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(transaction);
        return groups;
    }, {});
}

/**
 * Calculates summary statistics for a set of transactions
 * @param {Array} transactions - Array of transactions
 * @returns {Object} Summary statistics
 */
export function calculateSummary(transactions) {
    return transactions.reduce((summary, transaction) => {
        const amount = parseFloat(transaction.amount);
        if (transaction.type === 'income') {
            summary.totalIncome += amount;
        } else {
            summary.totalExpenses += amount;
        }
        summary.netBalance = summary.totalIncome - summary.totalExpenses;
        summary.savingsRate = summary.totalIncome > 0 
            ? ((summary.totalIncome - summary.totalExpenses) / summary.totalIncome) * 100 
            : 0;
        return summary;
    }, {
        totalIncome: 0,
        totalExpenses: 0,
        netBalance: 0,
        savingsRate: 0
    });
}

/**
 * Detects spending anomalies based on historical patterns
 * @param {Array} transactions - Array of transactions
 * @param {string} category - Transaction category
 * @returns {Array} Anomalous transactions
 */
export function detectAnomalies(transactions, category) {
    const categoryTransactions = transactions.filter(t => t.category === category && t.type === 'expense');
    if (categoryTransactions.length < 3) return [];

    const amounts = categoryTransactions.map(t => parseFloat(t.amount));
    const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const stdDev = Math.sqrt(
        amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / amounts.length
    );
    const threshold = mean + (2 * stdDev);

    return categoryTransactions.filter(t => parseFloat(t.amount) > threshold);
}

/**
 * Validates a transaction object
 * @param {Object} transaction - Transaction to validate
 * @returns {Object} Validation result
 */
export function validateTransaction(transaction) {
    const errors = {};
    const requiredFields = ['type', 'amount', 'category', 'date', 'userId', 'id', 'timestamp'];
    
    // Check for required fields
    for (const field of requiredFields) {
        if (!transaction[field]) {
            errors[field] = `${field} is required`;
            continue;
        }
    }

    // Validate individual fields if they exist
    if (transaction.amount) {
        const amount = parseFloat(transaction.amount);
        if (isNaN(amount) || amount <= 0) {
            errors.amount = 'Amount must be a positive number';
        }
    }

    if (transaction.type) {
        if (!['income', 'expense'].includes(transaction.type)) {
            errors.type = 'Invalid transaction type';
        }
    }

    if (transaction.category) {
        if (typeof transaction.category !== 'string' || transaction.category.trim() === '') {
            errors.category = 'Category must be a non-empty string';
        }
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
    
    if (transaction.date) {
        if (typeof transaction.date !== 'string' || !dateRegex.test(transaction.date)) {
            errors.date = 'Invalid date format. Must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)';
        }
    }

    if (transaction.timestamp) {
        if (typeof transaction.timestamp !== 'string' || !dateRegex.test(transaction.timestamp)) {
            errors.timestamp = 'Invalid timestamp format. Must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)';
        }
    }

    if (transaction.userId) {
        if (typeof transaction.userId !== 'string' || transaction.userId.trim() === '') {
            errors.userId = 'User ID must be a non-empty string';
        }
    }

    if (transaction.id) {
        if (typeof transaction.id !== 'string' || transaction.id.trim() === '') {
            errors.id = 'ID must be a non-empty string';
        }
    }

    // Log validation results for debugging
    console.log('Transaction validation:', {
        transaction,
        errors,
        isValid: Object.keys(errors).length === 0
    });

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Debounces a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Debounce delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds
 * @param {Function} func - Function to throttle
 * @param {number} wait - Throttle delay in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, wait) {
    let lastFunc;
    let lastRan;
    return function executedFunction(...args) {
        if (!lastRan) {
            func(...args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if ((Date.now() - lastRan) >= wait) {
                    func(...args);
                    lastRan = Date.now();
                }
            }, wait - (Date.now() - lastRan));
        }
    };
}
