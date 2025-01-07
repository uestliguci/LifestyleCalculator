import { STORAGE_KEYS } from './config.js';
import { validateTransaction } from './utils.js';

/**
 * Storage class to handle all localStorage operations
 */
class Storage {
    constructor() {
        this.initializeStorage();
    }

    /**
     * Initialize storage with default values if empty
     */
    initializeStorage() {
        if (!localStorage.getItem(STORAGE_KEYS.transactions)) {
            localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.settings)) {
            localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({
                monthlyBudget: 0,
                theme: 'light',
                currency: 'USD',
                notifications: true
            }));
        }
        if (!localStorage.getItem(STORAGE_KEYS.categories)) {
            localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify({}));
        }
    }

    /**
     * Get all transactions
     * @returns {Array} Array of transactions
     */
    getTransactions() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions)) || [];
        } catch (error) {
            console.error('Error reading transactions:', error);
            return [];
        }
    }

    /**
     * Add a new transaction
     * @param {Object} transaction - Transaction to add
     * @returns {Object} Result object with success status and message
     */
    addTransaction(transaction) {
        try {
            const validation = validateTransaction(transaction);
            if (!validation.isValid) {
                return {
                    success: false,
                    message: 'Invalid transaction data',
                    errors: validation.errors
                };
            }

            const transactions = this.getTransactions();
            transactions.push({
                ...transaction,
                id: Date.now().toString(36),
                timestamp: new Date().toISOString()
            });
            localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));

            return {
                success: true,
                message: 'Transaction added successfully'
            };
        } catch (error) {
            console.error('Error adding transaction:', error);
            return {
                success: false,
                message: 'Failed to add transaction'
            };
        }
    }

    /**
     * Update an existing transaction
     * @param {string} id - Transaction ID
     * @param {Object} updatedTransaction - Updated transaction data
     * @returns {Object} Result object with success status and message
     */
    updateTransaction(id, updatedTransaction) {
        try {
            const validation = validateTransaction(updatedTransaction);
            if (!validation.isValid) {
                return {
                    success: false,
                    message: 'Invalid transaction data',
                    errors: validation.errors
                };
            }

            const transactions = this.getTransactions();
            const index = transactions.findIndex(t => t.id === id);
            
            if (index === -1) {
                return {
                    success: false,
                    message: 'Transaction not found'
                };
            }

            transactions[index] = {
                ...transactions[index],
                ...updatedTransaction,
                lastModified: new Date().toISOString()
            };

            localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));

            return {
                success: true,
                message: 'Transaction updated successfully'
            };
        } catch (error) {
            console.error('Error updating transaction:', error);
            return {
                success: false,
                message: 'Failed to update transaction'
            };
        }
    }

    /**
     * Delete a transaction
     * @param {string} id - Transaction ID
     * @returns {Object} Result object with success status and message
     */
    deleteTransaction(id) {
        try {
            const transactions = this.getTransactions();
            const filteredTransactions = transactions.filter(t => t.id !== id);
            
            if (transactions.length === filteredTransactions.length) {
                return {
                    success: false,
                    message: 'Transaction not found'
                };
            }

            localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(filteredTransactions));

            return {
                success: true,
                message: 'Transaction deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting transaction:', error);
            return {
                success: false,
                message: 'Failed to delete transaction'
            };
        }
    }

    /**
     * Get application settings
     * @returns {Object} Settings object
     */
    getSettings() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.settings)) || {};
        } catch (error) {
            console.error('Error reading settings:', error);
            return {};
        }
    }

    /**
     * Update application settings
     * @param {Object} settings - Settings to update
     * @returns {Object} Result object with success status and message
     */
    updateSettings(settings) {
        try {
            const currentSettings = this.getSettings();
            const updatedSettings = { ...currentSettings, ...settings };
            localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(updatedSettings));

            return {
                success: true,
                message: 'Settings updated successfully'
            };
        } catch (error) {
            console.error('Error updating settings:', error);
            return {
                success: false,
                message: 'Failed to update settings'
            };
        }
    }

    /**
     * Export all data as JSON
     * @returns {string} JSON string of all data
     */
    exportData() {
        try {
            const data = {
                transactions: this.getTransactions(),
                settings: this.getSettings(),
                categories: JSON.parse(localStorage.getItem(STORAGE_KEYS.categories)),
                exportDate: new Date().toISOString()
            };
            return JSON.stringify(data, null, 2);
        } catch (error) {
            console.error('Error exporting data:', error);
            return null;
        }
    }

    /**
     * Import data from JSON
     * @param {string} jsonData - JSON string to import
     * @returns {Object} Result object with success status and message
     */
    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            // Validate data structure
            if (!data.transactions || !Array.isArray(data.transactions)) {
                throw new Error('Invalid transactions data');
            }

            // Import each section
            localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(data.transactions));
            if (data.settings) {
                localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(data.settings));
            }
            if (data.categories) {
                localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(data.categories));
            }

            return {
                success: true,
                message: 'Data imported successfully'
            };
        } catch (error) {
            console.error('Error importing data:', error);
            return {
                success: false,
                message: 'Failed to import data: ' + error.message
            };
        }
    }

    /**
     * Clear all stored data
     * @returns {Object} Result object with success status and message
     */
    clearData() {
        try {
            localStorage.clear();
            this.initializeStorage();
            return {
                success: true,
                message: 'All data cleared successfully'
            };
        } catch (error) {
            console.error('Error clearing data:', error);
            return {
                success: false,
                message: 'Failed to clear data'
            };
        }
    }
}

export const storage = new Storage();
