import { ANIMATION_DURATION, BUDGET_ALERTS, CATEGORIES } from './config.js';
import { indexedDBStorage } from './services/indexed-db-storage.js';
import { formatCurrency, formatDate, debounce, detectAnomalies } from './utils.js';
import { chartManager } from './charts.js';
import { pdfExport } from './services/pdf-export.js';

/**
 * UI Manager class to handle all UI-related operations
 */
class UIManager {
    constructor() {
        this.initializeEventListeners();
        this.setupAutocomplete();
        this.currentSection = 'daily-transaction';
        this.initializeDB();
    }

    async initializeDB() {
        try {
            await indexedDBStorage.init();
            console.log('IndexedDB initialized successfully');
        } catch (error) {
            console.error('Failed to initialize IndexedDB:', error);
            this.showAlert('Failed to initialize storage. Some features may not work.', 'error');
        }
    }

    /**
     * Initialize all event listeners
     */
    initializeEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchSection(btn.dataset.menu));
        });

        // Transaction Form
        const transactionForm = document.getElementById('transaction-form');
        if (transactionForm) {
            transactionForm.addEventListener('submit', (e) => this.handleTransactionSubmit(e));
            
            // Update category options when transaction type changes
            const typeSelect = document.getElementById('transaction-type');
            typeSelect.addEventListener('change', () => this.updateCategoryOptions(typeSelect.value));
            
            // Initialize category options
            this.updateCategoryOptions(typeSelect.value);
        }

        // Transaction Database Controls
        const searchInput = document.getElementById('search-transactions');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(() => this.filterTransactions(searchInput.value), 300));
        }

        const exportBtn = document.getElementById('export-data');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        // Analytics Controls
        const analyticsMonth = document.getElementById('analytics-month');
        if (analyticsMonth) {
            analyticsMonth.addEventListener('change', () => this.updateAnalytics(analyticsMonth.value));
        }

        // Visualization Controls
        const viewType = document.getElementById('view-type');
        if (viewType) {
            viewType.addEventListener('change', () => this.updateVisualization(viewType.value));
        }

        // Balance Sheet Controls
        const balanceSheetYear = document.getElementById('balance-sheet-year');
        if (balanceSheetYear) {
            balanceSheetYear.addEventListener('change', () => this.updateBalanceSheet(balanceSheetYear.value));
        }
    }

    /**
     * Switch between different sections
     * @param {string} sectionId - ID of the section to switch to
     */
    switchSection(sectionId) {
        // Update navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.menu === sectionId);
        });

        // Update sections
        document.querySelectorAll('.menu-section').forEach(section => {
            section.classList.toggle('active', section.id === sectionId);
        });

        this.currentSection = sectionId;
        this.refreshCurrentSection();
    }

    /**
     * Refresh the current section's data and charts
     */
    async refreshCurrentSection() {
        try {
            switch (this.currentSection) {
                case 'daily-transaction':
                    await this.updateBalanceIndicator();
                    break;
                case 'transaction-database':
                    await this.renderTransactionTable();
                    break;
                case 'monthly-analytics':
                    await this.updateAnalytics();
                    break;
                case 'spending-visualization':
                    await this.updateVisualization();
                    break;
                case 'balance-sheet':
                    await this.updateBalanceSheet();
                    break;
            }
        } catch (error) {
            console.error('Section refresh error:', error);
            this.showAlert('Failed to refresh section. Please try again.', 'error');
        }
    }

    /**
     * Handle transaction form submission
     * @param {Event} e - Form submit event
     */
    async handleTransactionSubmit(e) {
        e.preventDefault();
        
        try {
            const form = e.target;
            const now = new Date();
            const isoString = now.toISOString();
            const formattedDate = isoString.replace(/\.\d+/, '.000');
            const transactionId = now.getTime().toString(36);
            
            // Create transaction with all required fields
            const transaction = {
                type: form.querySelector('#transaction-type').value,
                amount: parseFloat(form.querySelector('#amount').value),
                category: form.querySelector('#category').value,
                description: form.querySelector('#description').value || '',
                date: formattedDate,
                timestamp: formattedDate,
                id: transactionId,
                userId: 'default' // Using default user ID for local storage
            };

            console.log('Submitting transaction:', transaction);
            const result = await indexedDBStorage.addTransaction(transaction);
            
            if (result.success) {
                this.showAlert('Transaction added successfully', 'success');
                form.reset();
                await this.updateBalanceIndicator();
                await this.checkBudgetAlerts();
            } else {
                if (result.errors) {
                    console.error('Validation errors:', result.errors);
                    const errorMessages = Object.values(result.errors).join(', ');
                    this.showAlert(`Validation errors: ${errorMessages}`, 'error');
                } else {
                    console.error('Transaction error:', result.message);
                    this.showAlert(result.message, 'error');
                }
            }
        } catch (error) {
            console.error('Transaction submission error:', error);
            this.showAlert('Failed to add transaction. Please try again.', 'error');
        }
    }

    /**
     * Update category options based on transaction type
     * @param {string} type - Transaction type ('income' or 'expense')
     */
    updateCategoryOptions(type) {
        const categorySelect = document.getElementById('category');
        const categories = CATEGORIES[type] || [];
        
        categorySelect.innerHTML = `
            <option value="">Select Category</option>
            ${categories.map(category => 
                `<option value="${category}">${category}</option>`
            ).join('')}
        `;
    }

    /**
     * Update the monthly balance indicator
     */
    async updateBalanceIndicator() {
        const transactions = await indexedDBStorage.getTransactions();
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthlyTransactions = transactions.filter(t => 
            t.date.startsWith(currentMonth)
        );

        const balance = monthlyTransactions.reduce((total, t) => 
            total + (t.type === 'income' ? 1 : -1) * t.amount
        , 0);

        const indicator = document.querySelector('.balance-amount');
        if (indicator) {
            indicator.textContent = formatCurrency(balance);
            indicator.className = `balance-amount ${balance >= 0 ? 'positive' : 'negative'}`;
        }
    }

    /**
     * Render the transaction table
     * @param {Array} transactions - Array of transactions to display
     */
    async renderTransactionTable() {
        const tbody = document.querySelector('#transactions-table tbody');
        const transactions = await indexedDBStorage.getTransactions();
        if (!tbody) return;

        tbody.innerHTML = transactions.map(t => `
            <tr data-id="${t.id}">
                <td>${formatDate(t.date)}</td>
                <td>${formatDate(t.date, 'HH:mm')}</td>
                <td class="transaction-type-${t.type}">${t.type}</td>
                <td>${t.category}</td>
                <td>${formatCurrency(t.amount)}</td>
                <td>${t.description || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-view" onclick="viewTransaction('${t.id}')">View</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Filter transactions based on search input
     * @param {string} query - Search query
     */
    async filterTransactions(query) {
        const transactions = await indexedDBStorage.getTransactions();
        const filtered = transactions.filter(t => 
            Object.values(t).some(value => 
                String(value).toLowerCase().includes(query.toLowerCase())
            )
        );
        this.renderTransactionTable(filtered);
    }

    /**
     * Update monthly analytics charts and summaries
     * @param {string} month - Month to analyze (YYYY-MM format)
     */
    async updateAnalytics(month = new Date().toISOString().slice(0, 7)) {
        const transactions = (await indexedDBStorage.getTransactions()).filter(t => 
            t.date.startsWith(month)
        );

        // Update summary cards
        const summary = document.getElementById('monthly-summary');
        if (summary) {
            const stats = transactions.reduce((acc, t) => {
                const amount = parseFloat(t.amount);
                if (t.type === 'income') {
                    acc.income += amount;
                } else {
                    acc.expenses += amount;
                }
                return acc;
            }, { income: 0, expenses: 0 });

            const savings = stats.income - stats.expenses;
            const savingsRate = stats.income > 0 ? (savings / stats.income) * 100 : 0;

            summary.innerHTML = `
                <div class="summary-card income">
                    <h4>Total Income</h4>
                    <div class="amount">${formatCurrency(stats.income)}</div>
                </div>
                <div class="summary-card expense">
                    <h4>Total Expenses</h4>
                    <div class="amount">${formatCurrency(stats.expenses)}</div>
                </div>
                <div class="summary-card savings">
                    <h4>Savings Rate</h4>
                    <div class="amount">${savingsRate.toFixed(1)}%</div>
                </div>
            `;
        }

        // Update charts
        chartManager.updateCategoryChart('category-chart', transactions);
        chartManager.updateTrendChart('trend-chart', transactions, 'daily');
    }

    /**
     * Update spending visualization charts
     * @param {string} viewType - View type ('daily', 'weekly', 'monthly')
     */
    async updateVisualization(viewType = 'daily') {
        const transactions = await indexedDBStorage.getTransactions();
        chartManager.updateTrendChart('spending-chart', transactions, viewType);
    }

    /**
     * Update balance sheet charts
     * @param {string} year - Year to analyze (YYYY format)
     */
    async updateBalanceSheet(year = new Date().getFullYear().toString()) {
        const transactions = (await indexedDBStorage.getTransactions()).filter(t => 
            t.date.startsWith(year)
        );

        chartManager.updateBalanceChart('balance-overview-chart', transactions);
        chartManager.updateSavingsChart('savings-chart', transactions);
    }

    /**
     * Show an alert message
     * @param {string} message - Message to display
     * @param {string} type - Alert type ('success', 'error', 'warning')
     */
    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} show`;
        alert.textContent = message;

        document.querySelector('.app-content').prepend(alert);

        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 300);
        }, ANIMATION_DURATION.alert);
    }

    /**
     * Check for budget alerts
     */
    async checkBudgetAlerts() {
        const settings = await indexedDBStorage.getSettings();
        if (!settings.monthlyBudget) return;

        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthlyExpenses = (await indexedDBStorage.getTransactions())
            .filter(t => t.date.startsWith(currentMonth) && t.type === 'expense')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const budgetPercentage = (monthlyExpenses / settings.monthlyBudget) * 100;

        if (budgetPercentage >= BUDGET_ALERTS.danger) {
            this.showAlert('Budget exceeded!', 'error');
        } else if (budgetPercentage >= BUDGET_ALERTS.warning) {
            this.showAlert(`Budget usage: ${budgetPercentage.toFixed(1)}%`, 'warning');
        }
    }

    /**
     * Setup autocomplete for transaction description
     */
    async setupAutocomplete() {
        const descriptionInput = document.getElementById('description');
        if (!descriptionInput) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'autocomplete-container';
        descriptionInput.parentNode.insertBefore(wrapper, descriptionInput);
        wrapper.appendChild(descriptionInput);

        const suggestions = document.createElement('div');
        suggestions.className = 'autocomplete-suggestions';
        wrapper.appendChild(suggestions);

        descriptionInput.addEventListener('input', debounce(async () => {
            const value = descriptionInput.value.toLowerCase();
            if (!value) {
                suggestions.classList.remove('show');
                return;
            }

            const transactions = await indexedDBStorage.getTransactions();
            const descriptions = [...new Set(transactions.map(t => t.description))].filter(Boolean);
            const matches = descriptions.filter(desc => 
                desc.toLowerCase().includes(value)
            );

            if (matches.length) {
                suggestions.innerHTML = matches.map(match => `
                    <div class="suggestion-item">${match}</div>
                `).join('');
                suggestions.classList.add('show');
            } else {
                suggestions.classList.remove('show');
            }
        }, 300));

        suggestions.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-item')) {
                descriptionInput.value = e.target.textContent;
                suggestions.classList.remove('show');
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                suggestions.classList.remove('show');
            }
        });
    }

    /**
     * Export data as JSON or PDF
     */
    async exportData() {
        try {
            // Show export options dialog
            const format = await this.showExportDialog();
            
            if (format === 'pdf') {
                await pdfExport.generateBankStatement();
                this.showAlert('Bank statement exported as PDF', 'success');
            } else if (format === 'json') {
                const data = await indexedDBStorage.exportData();
                if (!data) {
                    this.showAlert('Failed to export data', 'error');
                    return;
                }

                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `financial_data_${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showAlert('Failed to export data', 'error');
        }
    }

    /**
     * Show export format selection dialog
     * @returns {Promise<string>} Selected format ('pdf' or 'json')
     */
    showExportDialog() {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'export-dialog';
            dialog.innerHTML = `
                <div class="export-dialog-content">
                    <h3>Export Format</h3>
                    <button class="btn-primary" onclick="this.closest('.export-dialog').remove(); window._resolveExportFormat('pdf')">
                        Bank Statement (PDF)
                    </button>
                    <button class="btn-secondary" onclick="this.closest('.export-dialog').remove(); window._resolveExportFormat('json')">
                        Raw Data (JSON)
                    </button>
                </div>
            `;
            
            // Add dialog styles if not already present
            if (!document.getElementById('export-dialog-styles')) {
                const style = document.createElement('style');
                style.id = 'export-dialog-styles';
                style.textContent = `
                    .export-dialog {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1000;
                        backdrop-filter: blur(5px);
                    }
                    .export-dialog-content {
                        background: var(--surface-color);
                        padding: 1.5rem;
                        border-radius: 16px;
                        box-shadow: var(--shadow-lg);
                        display: flex;
                        flex-direction: column;
                        gap: 1rem;
                        min-width: 300px;
                    }
                    .export-dialog h3 {
                        margin: 0;
                        font-size: 1.25rem;
                        text-align: center;
                    }
                    .export-dialog button {
                        width: 100%;
                    }
                `;
                document.head.appendChild(style);
            }

            // Setup resolver
            window._resolveExportFormat = (format) => {
                delete window._resolveExportFormat;
                resolve(format);
            };

            document.body.appendChild(dialog);
        });
    }
}

// Initialize UI
export const ui = new UIManager();
