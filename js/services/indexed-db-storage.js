import { validateTransaction } from '../utils.js';
import { authService } from './auth.js';

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
            const user = authService.getCurrentUser();
            if (!user) {
                return {
                    success: false,
                    message: 'User not authenticated'
                };
            }

            // Add user ID to transaction
            transaction.userId = user.username;

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
            const user = authService.getCurrentUser();
            if (!user) {
                reject(new Error('User not authenticated'));
                return;
            }

            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const index = store.index('userId');
            const request = index.getAll(user.username);

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
            const user = authService.getCurrentUser();
            if (!user) {
                return {
                    success: false,
                    message: 'User not authenticated'
                };
            }

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

                    // Verify ownership
                    if (existingTransaction.userId !== user.username) {
                        resolve({
                            success: false,
                            message: 'Unauthorized to modify this transaction'
                        });
                        return;
                    }

                    const updated = {
                        ...existingTransaction,
                        ...updatedTransaction,
                        userId: user.username,
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
        const user = authService.getCurrentUser();
        if (!user) {
            return {
                success: false,
                message: 'User not authenticated'
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

                // Verify ownership
                if (existingTransaction.userId !== user.username) {
                    resolve({
                        success: false,
                        message: 'Unauthorized to delete this transaction'
                    });
                    return;
                }

                const deleteRequest = store.delete(id);

                deleteRequest.onsuccess = () => {
                    resolve({
                        success: true,
                        message: 'Transaction deleted successfully'
                    });
                };

                deleteRequest.onerror = () => {
                    console.error('Error deleting transaction:', deleteRequest.error);
                    reject({
                        success: false,
                        message: 'Failed to delete transaction'
                    });
                };
            };
        });
    }

    async getSettings() {
        return new Promise((resolve, reject) => {
            const user = authService.getCurrentUser();
            if (!user) {
                reject(new Error('User not authenticated'));
                return;
            }

            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(user.username);

            request.onsuccess = () => {
                resolve(request.result || {
                    ...this.defaultSettings,
                    userId: user.username
                });
            };

            request.onerror = () => {
                console.error('Error getting settings:', request.error);
                reject(this.defaultSettings);
            };
        });
    }

    async updateSettings(settings) {
        const user = authService.getCurrentUser();
        if (!user) {
            return {
                success: false,
                message: 'User not authenticated'
            };
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');

            const getRequest = store.get(user.username);

            getRequest.onsuccess = () => {
                const currentSettings = getRequest.result || this.defaultSettings;
                const updatedSettings = {
                    ...currentSettings,
                    ...settings,
                    userId: user.username
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
            const user = authService.getCurrentUser();
            if (!user) {
                return null;
            }

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
            const user = authService.getCurrentUser();
            if (!user) {
                return {
                    success: false,
                    message: 'User not authenticated'
                };
            }

            const data = JSON.parse(jsonData);
            
            if (!data.transactions || !Array.isArray(data.transactions)) {
                throw new Error('Invalid transactions data');
            }

            const transaction = this.db.transaction(['transactions', 'settings'], 'readwrite');
            const transactionsStore = transaction.objectStore('transactions');
            const settingsStore = transaction.objectStore('settings');

            // Clear existing user data
            await this.clearUserData(user.username);

            // Import transactions with user ID
            for (const t of data.transactions) {
                await transactionsStore.add({
                    ...t,
                    userId: user.username
                });
            }

            // Import settings with user ID
            if (data.settings) {
                await settingsStore.put({
                    ...data.settings,
                    userId: user.username
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

    async clearUserData(userId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions', 'settings'], 'readwrite');
            const transactionsStore = transaction.objectStore('transactions');
            const settingsStore = transaction.objectStore('settings');

            // Delete user's transactions
            const index = transactionsStore.index('userId');
            const request = index.openKeyCursor(IDBKeyRange.only(userId));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    transactionsStore.delete(cursor.primaryKey);
                    cursor.continue();
                }
            };

            // Delete user's settings
            settingsStore.delete(userId);

            transaction.oncomplete = () => {
                resolve({
                    success: true,
                    message: 'User data cleared successfully'
                });
            };

            transaction.onerror = () => {
                console.error('Error clearing user data:', transaction.error);
                reject({
                    success: false,
                    message: 'Failed to clear user data'
                });
            };
        });
    }
}

export const indexedDBStorage = new IndexedDBStorage();
