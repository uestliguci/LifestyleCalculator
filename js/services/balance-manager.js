import { localStorageManager } from './local-storage-manager.js';
import { formatCurrency } from '../utils.js';
import { CATEGORIES } from '../config.js';

export class BalanceManager {
    constructor() {
        this.transactions = [];
        this.ui = null;
    }

    setUI(ui) {
        this.ui = ui;
    }

    async loadTransactions() {
        this.transactions = await localStorageManager.getTransactions();
        return this.transactions;
    }

    async deleteTransaction(id) {
        try {
            await localStorageManager.deleteTransaction(id);
            this.transactions = this.transactions.filter(t => t.id !== id);
            if (this.ui) {
                await this.ui.refreshCurrentSection();
                this.ui.showAlert('Transaction deleted successfully', 'success');
            }
            return true;
        } catch (error) {
            console.error('Delete transaction error:', error);
            if (this.ui) {
                this.ui.showAlert('Failed to delete transaction', 'error');
            }
            return false;
        }
    }

    async editTransaction(transaction) {
        try {
            await localStorageManager.updateTransaction(transaction.id, transaction);
            const index = this.transactions.findIndex(t => t.id === transaction.id);
            if (index !== -1) {
                this.transactions[index] = transaction;
            }
            if (this.ui) {
                await this.ui.refreshCurrentSection();
                this.ui.showAlert('Transaction updated successfully', 'success');
            }
            return true;
        } catch (error) {
            console.error('Edit transaction error:', error);
            if (this.ui) {
                this.ui.showAlert('Failed to update transaction', 'error');
            }
            return false;
        }
    }

    showEditModal(transactionId) {
        const transaction = this.transactions.find(t => t.id === transactionId);
        if (!transaction) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit Transaction</h3>
                    <button class="btn-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <form id="edit-transaction-form">
                    <div class="form-group">
                        <label for="edit-type">Type</label>
                        <select id="edit-type" required>
                            <option value="expense" ${transaction.type === 'expense' ? 'selected' : ''}>Expense</option>
                            <option value="income" ${transaction.type === 'income' ? 'selected' : ''}>Income</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-amount">Amount</label>
                        <input type="number" id="edit-amount" value="${transaction.amount}" step="0.01" min="0" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-category">Category</label>
                        <select id="edit-category" required>
                            ${this.getCategoryOptions(transaction.type, transaction.category)}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-description">Description</label>
                        <input type="text" id="edit-description" value="${transaction.description || ''}">
                    </div>
                    <button type="submit" class="btn-primary">Save Changes</button>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Handle type change to update categories
        const typeSelect = modal.querySelector('#edit-type');
        const categorySelect = modal.querySelector('#edit-category');
        typeSelect.addEventListener('change', () => {
            categorySelect.innerHTML = this.getCategoryOptions(typeSelect.value);
        });

        const form = modal.querySelector('#edit-transaction-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const updatedTransaction = {
                ...transaction,
                type: form.querySelector('#edit-type').value,
                amount: parseFloat(form.querySelector('#edit-amount').value),
                category: form.querySelector('#edit-category').value,
                description: form.querySelector('#edit-description').value
            };

            if (await this.editTransaction(updatedTransaction)) {
                modal.remove();
            }
        });
    }

    showDeleteConfirmation(transactionId) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Delete Transaction</h3>
                    <button class="btn-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <p class="modal-message">Are you sure you want to delete this transaction?</p>
                <div class="modal-actions">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn-danger" id="confirm-delete">Delete</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const confirmButton = modal.querySelector('#confirm-delete');
        confirmButton.addEventListener('click', async () => {
            if (await this.deleteTransaction(transactionId)) {
                modal.remove();
            }
        });
    }

    getCategoryOptions(type, selected = '') {
        const categories = CATEGORIES[type.toLowerCase()] || [];
        return categories.map(category => 
            `<option value="${category}" ${category === selected ? 'selected' : ''}>${category}</option>`
        ).join('');
    }
}

// Create and export balance manager instance
export const balanceManager = new BalanceManager();

// Make balance manager globally available
window.balanceManager = balanceManager;
