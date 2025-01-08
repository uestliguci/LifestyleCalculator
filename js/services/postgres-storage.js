/**
 * PostgreSQL storage service
 */
class PostgresStorage {
    constructor() {
        this.baseUrl = 'http://localhost:3001';
        this.dbConfig = {
            host: 'localhost',
            port: 5432,
            password: '1234'
        };
    }

    /**
     * Initialize database connection
     */
    async init() {
        try {
            const response = await fetch(`${this.baseUrl}/init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.dbConfig)
            });
            
            if (!response.ok) {
                throw new Error('Failed to initialize database');
            }
            
            return { success: true };
        } catch (error) {
            console.error('Database initialization error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Add a transaction to the database
     */
    async addTransaction(transaction) {
        try {
            const response = await fetch(`${this.baseUrl}/transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transaction)
            });

            if (!response.ok) {
                throw new Error('Failed to add transaction');
            }

            return { success: true };
        } catch (error) {
            console.error('Add transaction error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Update a transaction
     */
    async updateTransaction(transaction) {
        try {
            const response = await fetch(`${this.baseUrl}/transactions/${transaction.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transaction)
            });

            if (!response.ok) {
                throw new Error('Failed to update transaction');
            }

            return { success: true };
        } catch (error) {
            console.error('Update transaction error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Delete a transaction
     */
    async deleteTransaction(id) {
        try {
            const response = await fetch(`${this.baseUrl}/transactions/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete transaction');
            }

            return { success: true };
        } catch (error) {
            console.error('Delete transaction error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Get all transactions
     */
    async getAllTransactions() {
        try {
            const response = await fetch(`${this.baseUrl}/transactions`);
            if (!response.ok) {
                throw new Error('Failed to get transactions');
            }
            return await response.json();
        } catch (error) {
            console.error('Get transactions error:', error);
            return [];
        }
    }

    /**
     * Get transactions for a specific user
     */
    async getTransactions(userId = 'default') {
        try {
            const response = await fetch(`${this.baseUrl}/transactions/${userId}`);
            if (!response.ok) {
                throw new Error('Failed to get transactions');
            }
            return await response.json();
        } catch (error) {
            console.error('Get transactions error:', error);
            return [];
        }
    }

    /**
     * Export data as JSON
     */
    async exportData() {
        try {
            const transactions = await this.getAllTransactions();
            return JSON.stringify(transactions, null, 2);
        } catch (error) {
            console.error('Export error:', error);
            return null;
        }
    }

    /**
     * Import data from JSON
     */
    async importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            const response = await fetch(`${this.baseUrl}/transactions/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error('Failed to import data');
            }

            return { success: true };
        } catch (error) {
            console.error('Import error:', error);
            return { success: false, message: error.message };
        }
    }
}

export const postgresStorage = new PostgresStorage();
