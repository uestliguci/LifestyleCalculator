import { STORAGE_KEYS } from '../config.js';
import { validateTransaction } from '../utils.js';

/**
 * StorageManager class to handle all data storage operations
 * Uses localStorage for GitHub Pages deployment
 */
class StorageManager {
    constructor() {
        this.currentUser = null;
        this.initializeStorage();
    }

    setCurrentUser(user) {
        this.currentUser = user;
        this.initializeStorage();
    }

    getUserKey(key) {
        if (!this.currentUser) {
            throw new Error('No user logged in');
        }
        return `${this.currentUser.username}_${key}`;
    }

    initializeStorage() {
        if (!this.currentUser) return;

        // Initialize storage with default values if empty
        const transactionsKey = this.getUserKey(STORAGE_KEYS.transactions);
        const settingsKey = this.getUserKey(STORAGE_KEYS.settings);

        if (!localStorage.getItem(transactionsKey)) {
            localStorage.setItem(transactionsKey, JSON.stringify([]));
        }
        if (!localStorage.getItem(settingsKey)) {
            localStorage.setItem(settingsKey, JSON.stringify({
                monthlyBudget: 0,
                theme: 'light',
                currency: 'ALL',
                notifications: true
            }));
        }
    }

    async getTransactions() {
        try {
            if (!this.currentUser) {
                return [];
            }
            const transactionsKey = this.getUserKey(STORAGE_KEYS.transactions);
            return JSON.parse(localStorage.getItem(transactionsKey)) || [];
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
            const transactionsKey = this.getUserKey(STORAGE_KEYS.transactions);
            localStorage.setItem(transactionsKey, JSON.stringify(transactions));

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

            const transactionsKey = this.getUserKey(STORAGE_KEYS.transactions);
            localStorage.setItem(transactionsKey, JSON.stringify(transactions));

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

            const transactionsKey = this.getUserKey(STORAGE_KEYS.transactions);
            localStorage.setItem(transactionsKey, JSON.stringify(filteredTransactions));

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
            if (!this.currentUser) {
                return {};
            }
            const settingsKey = this.getUserKey(STORAGE_KEYS.settings);
            return JSON.parse(localStorage.getItem(settingsKey)) || {};
        } catch (error) {
            console.error('Error reading settings:', error);
            return {};
        }
    }

    updateSettings(settings) {
        try {
            const currentSettings = this.getSettings();
            const updatedSettings = { ...currentSettings, ...settings };
            const settingsKey = this.getUserKey(STORAGE_KEYS.settings);
            localStorage.setItem(settingsKey, JSON.stringify(updatedSettings));
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

            const transactionsKey = this.getUserKey(STORAGE_KEYS.transactions);
            const settingsKey = this.getUserKey(STORAGE_KEYS.settings);
            
            localStorage.setItem(transactionsKey, JSON.stringify(data.transactions));
            
            if (data.settings) {
                localStorage.setItem(settingsKey, JSON.stringify(data.settings));
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
            const transactionsKey = this.getUserKey(STORAGE_KEYS.transactions);
            const settingsKey = this.getUserKey(STORAGE_KEYS.settings);
            
            localStorage.setItem(transactionsKey, JSON.stringify([]));
            localStorage.setItem(settingsKey, JSON.stringify({
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
