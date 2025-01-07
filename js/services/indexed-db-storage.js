import { validateTransaction } from '../utils.js';

class IndexedDBStorage {
    constructor() {
        this.dbName = 'LifestyleCalculatorDB';
        this.version = 1;
        this.db = null;
        this.defaultSettings = {
            monthlyBudget: 0,
            theme: 'light',
            currency: 'USD',
            notifications: true
        };
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Error opening database:', request.error);
                reject(request.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('Database opened successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create transactions store
                if (!db.objectStoreNames.contains('transactions')) {
                    const transactionsStore = db.createObjectStore('transactions', { keyPath: 'id' });
                    transactionsStore.createIndex('userId', 'userId', { unique: false });
                    transactionsStore.createIndex('date', 'date', { unique: false });
                    transactionsStore.createIndex('type', 'type', { unique: false });
                }

                // Create settings store
                if (!db.objectStoreNames.contains('settings')) {
                    const settingsStore = db.createObjectStore('settings', { keyPath: 'userId' });
                }
            };
        });
    }

    async addTransaction(transaction) {
        try {
            // Validate transaction data
            const validation = validateTransaction(transaction);
            if (!validation.isValid) {
                return {
                    success: false,
                    message: 'Invalid transaction data',
                    errors: validation.errors
                };
            }

            return new Promise((resolve, reject) => {
                const dbTransaction = this.db.transaction(['transactions'], 'readwrite');
                const store = dbTransaction.objectStore('transactions');

                const request = store.add(transaction);

                request.onsuccess = () => {
                    resolve({
                        success: true,
                        message: 'Transaction added successfully',
                        transactionId: transaction.id
                    });
                };

                request.onerror = () => {
                    console.error('Error adding transaction:', request.error);
                    reject({
                        success: false,
                        message: 'Failed to add transaction'
                    });
                };
            });
        } catch (error) {
            console.error('Error adding transaction:', error);
            return {
                success: false,
                message: 'Failed to add transaction'
            };
        }
    }

    async getTransactions() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Error getting transactions:', request.error);
                reject([]);
            };
        });
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

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['transactions'], 'readwrite');
                const store = transaction.objectStore('transactions');

                const getRequest = store.get(id);

                getRequest.onsuccess = () => {
                    const existingTransaction = getRequest.result;
                    if (!existingTransaction) {
                        resolve({
                            success: false,
                            message: 'Transaction not found'
                        });
                        return;
                    }

                    const updated = {
                        ...existingTransaction,
                        ...updatedTransaction,
                        lastModified: new Date().toISOString()
                    };

                    const updateRequest = store.put(updated);

                    updateRequest.onsuccess = () => {
                        resolve({
                            success: true,
                            message: 'Transaction updated successfully'
                        });
                    };

                    updateRequest.onerror = () => {
                        console.error('Error updating transaction:', updateRequest.error);
                        reject({
                            success: false,
                            message: 'Failed to update transaction'
                        });
                    };
                };
            });
        } catch (error) {
            console.error('Error updating transaction:', error);
            return {
                success: false,
                message: 'Failed to update transaction'
            };
        }
    }

    async deleteTransaction(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');

            const request = store.delete(id);

            request.onsuccess = () => {
                resolve({
                    success: true,
                    message: 'Transaction deleted successfully'
                });
            };

            request.onerror = () => {
                console.error('Error deleting transaction:', request.error);
                reject({
                    success: false,
                    message: 'Failed to delete transaction'
                });
            };
        });
    }

    async getSettings() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get('default');

            request.onsuccess = () => {
                resolve(request.result || this.defaultSettings);
            };

            request.onerror = () => {
                console.error('Error getting settings:', request.error);
                reject(this.defaultSettings);
            };
        });
    }

    async updateSettings(settings) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');

            const getRequest = store.get('default');

            getRequest.onsuccess = () => {
                const currentSettings = getRequest.result || this.defaultSettings;
                const updatedSettings = {
                    ...currentSettings,
                    ...settings,
                    userId: 'default'
                };

                const updateRequest = store.put(updatedSettings);

                updateRequest.onsuccess = () => {
                    resolve({
                        success: true,
                        message: 'Settings updated successfully'
                    });
                };

                updateRequest.onerror = () => {
                    console.error('Error updating settings:', updateRequest.error);
                    reject({
                        success: false,
                        message: 'Failed to update settings'
                    });
                };
            };
        });
    }

    async exportData() {
        try {
            const [transactions, settings] = await Promise.all([
                this.getTransactions(),
                this.getSettings()
            ]);

            const data = {
                transactions,
                settings,
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

            const transaction = this.db.transaction(['transactions', 'settings'], 'readwrite');
            const transactionsStore = transaction.objectStore('transactions');
            const settingsStore = transaction.objectStore('settings');

            // Clear existing data
            await this.clearData();

            // Import transactions
            for (const t of data.transactions) {
                await transactionsStore.add(t);
            }

            // Import settings
            if (data.settings) {
                await settingsStore.put({
                    ...data.settings,
                    userId: 'default'
                });
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
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions', 'settings'], 'readwrite');
            const transactionsStore = transaction.objectStore('transactions');
            const settingsStore = transaction.objectStore('settings');

            transactionsStore.clear();
            settingsStore.clear();

            transaction.oncomplete = () => {
                resolve({
                    success: true,
                    message: 'All data cleared successfully'
                });
            };

            transaction.onerror = () => {
                console.error('Error clearing data:', transaction.error);
                reject({
                    success: false,
                    message: 'Failed to clear data'
                });
            };
        });
    }
}

export const indexedDBStorage = new IndexedDBStorage();
