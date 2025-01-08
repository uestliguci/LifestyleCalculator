import { STORAGE_KEYS } from '../config.js';
import { validateTransaction } from '../utils.js';

/**
 * StorageManager class to handle all data storage operations
 * Uses localStorage for GitHub Pages deployment
 */
class StorageManager {
    constructor() {
        this.initializeStorage();
    }

    initializeStorage() {
        // Initialize storage with default values if empty
        if (!localStorage.getItem(STORAGE_KEYS.transactions)) {
            localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.settings)) {
            localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({
                monthlyBudget: 0,
                theme: 'light',
                currency: 'ALL',
                notifications: true
            }));
        }
    }

    async getTransactions() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions)) || [];
        } catch (error) {
            console.error('Error reading transactions:', error);
            return [];
        }
    }

    async addTransaction(transaction) {
        try {
            const validation = validateTransaction(transaction);
            if (!validation.isValid) {
                return {
                    success: false,
                    message: 'Invalid transaction data',
                    errors: validation.errors
                };
            }

            const transactions = await this.getTransactions();
            const newTransaction = {
                ...transaction,
                id: Date.now().toString(36),
                timestamp: new Date().toISOString()
            };

            transactions.push(newTransaction);
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

    async updateTransaction(id, updatedTransaction) {
        try {
            const validation = validateTransaction(updatedTransaction);
            if (!validation.isValid) {
                return {
                    success: false,
                    message: 'Invalid transaction data',
                    errors: validation.errors
                };
            }

            const transactions = await this.getTransactions();
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

    async deleteTransaction(id) {
        try {
            const transactions = await this.getTransactions();
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

    getSettings() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.settings)) || {};
        } catch (error) {
            console.error('Error reading settings:', error);
            return {};
        }
    }

    updateSettings(settings) {
        try {
            const currentSettings = this.getSettings();
            const updatedSettings = { ...currentSettings, ...settings };
            localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(updatedSettings));
            return { success: true, message: 'Settings updated successfully' };
        } catch (error) {
            console.error('Error updating settings:', error);
            return { success: false, message: 'Failed to update settings' };
        }
    }

    async exportData() {
        try {
            const data = {
                transactions: await this.getTransactions(),
                settings: this.getSettings(),
                exportDate: new Date().toISOString()
            };
            return JSON.stringify(data, null, 2);
        } catch (error) {
            console.error('Error exporting data:', error);
            return null;
        }
    }

    async importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (!data.transactions || !Array.isArray(data.transactions)) {
                throw new Error('Invalid transactions data');
            }

            localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(data.transactions));
            
            if (data.settings) {
                localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(data.settings));
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

    async clearData() {
        try {
            localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([]));
            localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({
                monthlyBudget: 0,
                theme: 'light',
                currency: 'ALL',
                notifications: true
            }));

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

export const storageManager = new StorageManager();
