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
            const result = await localStorageManager.updateTransaction(transaction.id, transaction);
            
            if (result.success) {
                const index = this.transactions.findIndex(t => t.id === transaction.id);
                if (index !== -1) {
                    this.transactions[index] = {
                        ...transaction,
                        lastModified: new Date().toISOString()
                    };
                }
                if (this.ui) {
                    await this.ui.refreshCurrentSection();
                    this.ui.showAlert('Transaction updated successfully', 'success');
                }
                return true;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Edit transaction error:', error);
            if (this.ui) {
                this.ui.showAlert(error.message || 'Failed to update transaction', 'error');
            }
            return false;
        }
    }

    showEditModal(transactionId) {
        const transaction = this.transactions.find(t => t.id === transactionId);
        if (!transaction) {
            console.error('Transaction not found:', transactionId);
            if (this.ui) {
                this.ui.showAlert('Transaction not found', 'error');
            }
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'edit-transaction-modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit Transaction</h3>
                    <button class="btn-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <form id="edit-transaction-form" class="ios-form">
                    <div class="form-group">
                        <label for="edit-type">Transaction Type</label>
                        <select id="edit-type" class="ios-select" required>
                            <option value="expense" ${transaction.type === 'expense' ? 'selected' : ''}>Expense</option>
                            <option value="income" ${transaction.type === 'income' ? 'selected' : ''}>Income</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-amount">Amount (Lek)</label>
                        <input type="number" id="edit-amount" class="ios-input" value="${transaction.amount}" step="0.01" min="0" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-category">Category</label>
                        <select id="edit-category" class="ios-select" required>
                            ${this.getCategoryOptions(transaction.type, transaction.category)}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-description">Description (Optional)</label>
                        <input type="text" id="edit-description" class="ios-input" value="${transaction.description || ''}" placeholder="Add a note">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn-primary">Save Changes</button>
                    </div>
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

        // Handle form submission
        const form = modal.querySelector('#edit-transaction-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const updatedTransaction = {
                ...transaction,
                type: form.querySelector('#edit-type').value,
                amount: parseFloat(form.querySelector('#edit-amount').value),
                category: form.querySelector('#edit-category').value,
                description: form.querySelector('#edit-description').value,
                lastModified: new Date().toISOString()
            };

            try {
                const success = await this.editTransaction(updatedTransaction);
                if (success) {
                    modal.remove();
                    if (this.ui) {
                        this.ui.showAlert('Transaction updated successfully', 'success');
                    }
                }
            } catch (error) {
                console.error('Failed to update transaction:', error);
                if (this.ui) {
                    this.ui.showAlert('Failed to update transaction', 'error');
                }
            }
        });

        // Add iOS-style form validation
        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('invalid', (e) => {
                e.preventDefault();
                input.classList.add('invalid');
            });
            input.addEventListener('input', () => {
                input.classList.remove('invalid');
            });
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
