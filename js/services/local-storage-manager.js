/**
 * LocalStorageManager class for simple, persistent data storage
 * No authentication required, works offline, and compatible with all devices
 */
class LocalStorageManager {
    constructor() {
        this.STORAGE_KEYS = {
            transactions: 'lifestyle_calculator_transactions',
            settings: 'lifestyle_calculator_settings'
        };
        this.initializeStorage();
    }

    initializeStorage() {
        // Initialize storage with default values if empty
        if (!localStorage.getItem(this.STORAGE_KEYS.transactions)) {
            localStorage.setItem(this.STORAGE_KEYS.transactions, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.STORAGE_KEYS.settings)) {
            localStorage.setItem(this.STORAGE_KEYS.settings, JSON.stringify({
                monthlyBudget: 0,
                theme: 'light',
                currency: 'ALL',
                notifications: true
            }));
        }
    }

    async getTransactions() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.transactions)) || [];
        } catch (error) {
            console.error('Error reading transactions:', error);
            return [];
        }
    }

    async addTransaction(transaction) {
        try {
            const transactions = await this.getTransactions();
            const newTransaction = {
                ...transaction,
                id: Date.now().toString(36),
                timestamp: new Date().toISOString()
            };

            transactions.push(newTransaction);
            localStorage.setItem(this.STORAGE_KEYS.transactions, JSON.stringify(transactions));

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

            localStorage.setItem(this.STORAGE_KEYS.transactions, JSON.stringify(transactions));

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

            localStorage.setItem(this.STORAGE_KEYS.transactions, JSON.stringify(filteredTransactions));

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
            return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.settings)) || {};
        } catch (error) {
            console.error('Error reading settings:', error);
            return {};
        }
    }

    updateSettings(settings) {
        try {
            const currentSettings = this.getSettings();
            const updatedSettings = { ...currentSettings, ...settings };
            localStorage.setItem(this.STORAGE_KEYS.settings, JSON.stringify(updatedSettings));
            return { success: true, message: 'Settings updated successfully' };
        } catch (error) {
            console.error('Error updating settings:', error);
            return { success: false, message: 'Failed to update settings' };
        }
    }

    async getAllData() {
        try {
            return {
                transactions: await this.getTransactions(),
                settings: this.getSettings(),
                exportDate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting all data:', error);
            throw error;
        }
    }

    async restoreData(data) {
        try {
            if (!data.transactions || !Array.isArray(data.transactions)) {
                throw new Error('Invalid transactions data');
            }

            // Validate transactions
            const validTransactions = data.transactions.every(t => 
                t.id && t.type && t.amount && t.category && t.date
            );

            if (!validTransactions) {
                throw new Error('Invalid transaction format');
            }

            // Validate settings
            if (data.settings) {
                const requiredSettings = ['monthlyBudget', 'theme', 'currency', 'notifications'];
                const hasAllSettings = requiredSettings.every(key => key in data.settings);
                if (!hasAllSettings) {
                    throw new Error('Invalid settings format');
                }
            }

            // Save data
            await this.clearData();
            localStorage.setItem(this.STORAGE_KEYS.transactions, JSON.stringify(data.transactions));
            if (data.settings) {
                localStorage.setItem(this.STORAGE_KEYS.settings, JSON.stringify(data.settings));
            }

            return {
                success: true,
                message: 'Data restored successfully'
            };
        } catch (error) {
            console.error('Error restoring data:', error);
            throw error;
        }
    }

    async importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (!data.transactions || !Array.isArray(data.transactions)) {
                throw new Error('Invalid transactions data');
            }
            
            localStorage.setItem(this.STORAGE_KEYS.transactions, JSON.stringify(data.transactions));
            
            if (data.settings) {
                localStorage.setItem(this.STORAGE_KEYS.settings, JSON.stringify(data.settings));
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

    async updateBudgetSettings(settings) {
        try {
            const currentSettings = this.getSettings();
            const updatedSettings = {
                ...currentSettings,
                monthlyBudget: settings.monthlyBudget || 0,
                categoryBudgets: settings.categoryBudgets || {},
                budgetAlerts: settings.budgetAlerts || true
            };
            localStorage.setItem(this.STORAGE_KEYS.settings, JSON.stringify(updatedSettings));
            return { success: true, message: 'Budget settings updated successfully' };
        } catch (error) {
            console.error('Error updating budget settings:', error);
            return { success: false, message: 'Failed to update budget settings' };
        }
    }

    async clearData() {
        try {
            localStorage.setItem(this.STORAGE_KEYS.transactions, JSON.stringify([]));
            localStorage.setItem(this.STORAGE_KEYS.settings, JSON.stringify({
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

export const localStorageManager = new LocalStorageManager();
