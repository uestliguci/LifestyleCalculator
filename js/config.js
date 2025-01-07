// Transaction Categories
const CATEGORIES = {
    income: [
        'Salary',
        'Bonus',
        'OTC',
        'Others'
    ],
    expense: [
        'Ciggies',
        'Food',
        'Clothes',
        'Gifts',
        'Savings',
        'Activities',
        'Online'
    ]
};

// Currency Configuration
const CURRENCIES = {
    ALL: {
        code: 'ALL',
        name: 'Albanian Lek',
        symbol: 'L',
        position: 'after' // currency symbol position
    },
    USD: {
        code: 'USD',
        name: 'United States Dollar',
        symbol: '$',
        position: 'before'
    },
    EUR: {
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        position: 'before'
    },
    GBP: {
        code: 'GBP',
        name: 'UK Pound Sterling',
        symbol: '£',
        position: 'before'
    }
};

// Chart Colors
const CHART_COLORS = {
    income: '#2ecc71',
    expense: '#e74c3c',
    neutral: '#3498db',
    background: 'rgba(255, 255, 255, 0.9)'
};

// Date Formats
const DATE_FORMATS = {
    display: {
        date: 'MMM DD, YYYY',
        time: 'hh:mm A',
        month: 'MMMM YYYY'
    },
    storage: {
        date: 'YYYY-MM-DD',
        time: 'HH:mm:ss',
        month: 'YYYY-MM'
    }
};

// Local Storage Keys
const STORAGE_KEYS = {
    transactions: 'financial_transactions',
    settings: 'financial_settings',
    categories: 'custom_categories'
};

// Chart Configuration Defaults
const CHART_CONFIG = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom',
            labels: {
                padding: 20,
                usePointStyle: true
            }
        },
        tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 12,
            cornerRadius: 4
        }
    }
};

// Budget Alert Thresholds (percentage of budget)
const BUDGET_ALERTS = {
    warning: 80,  // Show warning when 80% of budget is used
    danger: 100   // Show danger alert when budget is exceeded
};

// Animation Durations (in milliseconds)
const ANIMATION_DURATION = {
    chart: 800,
    transition: 300,
    alert: 5000
};

// Export configurations
export {
    CATEGORIES,
    CURRENCIES,
    CHART_COLORS,
    DATE_FORMATS,
    STORAGE_KEYS,
    CHART_CONFIG,
    BUDGET_ALERTS,
    ANIMATION_DURATION
};
