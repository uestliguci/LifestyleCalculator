/**
 * Application configuration
 */

// Transaction categories
export const CATEGORIES = {
    expense: [
        'Food',
        'Transportation',
        'Housing',
        'Utilities',
        'Healthcare',
        'Entertainment',
        'Shopping',
        'Education',
        'Personal Care',
        'Insurance',
        'Savings',
        'Other'
    ],
    income: [
        'Salary',
        'Business',
        'Investments',
        'Freelance',
        'Rental',
        'Other'
    ]
};

// Currency configuration
export const CURRENCIES = {
    ALL: {
        symbol: 'Lek',
        position: 'after'
    }
};

// Animation durations (in milliseconds)
export const ANIMATION_DURATION = {
    alert: 3000,
    transition: 300,
    modal: 200
};

// Budget alerts configuration
export const BUDGET_ALERTS = [
    {
        type: 'total',
        threshold: 50000,
        message: 'Monthly expenses have exceeded 50,000 Lek'
    },
    {
        type: 'category',
        category: 'Food',
        threshold: 10000,
        message: 'Food expenses have exceeded 10,000 Lek'
    }
];

// Date format configuration
export const DATE_FORMATS = {
    display: {
        date: 'MMM DD, YYYY',
        time: 'hh:mm A',
        dateTime: 'MMM DD, YYYY hh:mm A',
        month: 'MMMM YYYY'
    },
    storage: {
        date: 'YYYY-MM-DD',
        time: 'HH:mm',
        dateTime: 'YYYY-MM-DDTHH:mm:ss.sssZ',
        month: 'YYYY-MM'
    }
};
