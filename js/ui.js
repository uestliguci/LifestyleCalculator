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
        this.addSectionTransitionStyles();
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
        // Tab Bar Navigation
        document.querySelectorAll('.tab-item').forEach(btn => {
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
        // Update tab bar buttons
        document.querySelectorAll('.tab-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.menu === sectionId);
        });

        // Update sections with slide animation
        const sections = document.querySelectorAll('.menu-section');
        sections.forEach(section => {
            if (section.id === sectionId) {
                section.style.display = 'block';
                setTimeout(() => section.classList.add('active'), 50);
            } else {
                section.classList.remove('active');
                setTimeout(() => {
                    if (!section.classList.contains('active')) {
                        section.style.display = 'none';
                    }
                }, 300); // Match animation duration
            }
        });

        this.currentSection = sectionId;
        this.refreshCurrentSection();
    }

    /**
     * Refresh the current section's data and charts
     */
    async refreshCurrentSection() {
        try {
            // Always update balance indicator
            await this.updateBalanceIndicator();

            switch (this.currentSection) {
                case 'transactions':
                    await this.renderTransactionList();
                    break;
                case 'analytics':
                    await this.updateAnalytics();
                    break;
                case 'settings':
                    // Nothing to refresh in settings
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
        this.renderTransactionList(filtered);
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
     * Update balance indicator with current total
     */
    async updateBalanceIndicator() {
        const transactions = await indexedDBStorage.getTransactions();
        const balance = transactions.reduce((total, t) => 
            total + (t.type.toLowerCase() === 'income' ? 1 : -1) * parseFloat(t.amount)
        , 0);

        const indicator = document.querySelector('.balance-amount');
        if (indicator) {
            indicator.textContent = formatCurrency(balance);
            indicator.className = `balance-amount ${balance >= 0 ? 'positive' : 'negative'}`;
        }
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
     * Add section transition styles
     */
    addSectionTransitionStyles() {
        if (!document.getElementById('section-transition-styles')) {
            const style = document.createElement('style');
            style.id = 'section-transition-styles';
            style.textContent = `
                .menu-section {
                    display: none;
                    opacity: 0;
                    transform: translateX(20px);
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                
                .menu-section.active {
                    display: block;
                    opacity: 1;
                    transform: translateX(0);
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Render transaction list in iOS style
     * @param {Array} transactions - Optional transactions array to render
     */
    async renderTransactionList(transactions = null) {
        const transactionsList = document.getElementById('transactions-list');
        if (!transactionsList) return;

        if (!transactions) {
            transactions = await indexedDBStorage.getTransactions();
        }

        // Group transactions by date
        const groupedTransactions = transactions.reduce((groups, t) => {
            const date = new Date(t.date).toLocaleDateString();
            if (!groups[date]) groups[date] = [];
            groups[date].push(t);
            return groups;
        }, {});

        transactionsList.innerHTML = Object.entries(groupedTransactions).map(([date, dayTransactions]) => `
            <div class="transaction-group">
                <div class="transaction-date">${date}</div>
                ${dayTransactions.map(t => `
                    <div class="transaction-item" data-id="${t.id}" onclick="viewTransaction('${t.id}')">
                        <div class="transaction-info">
                            <div class="transaction-title">${t.category}</div>
                            <div class="transaction-category">${t.description || 'No description'}</div>
                        </div>
                        <div class="transaction-amount ${t.type.toLowerCase()}">
                            ${t.type === 'expense' ? '-' : '+'}${formatCurrency(t.amount)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');
    }

    /**
     * Export data as PDF or JSON
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
            dialog.className = 'modal';
            dialog.style.display = 'flex';
            dialog.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Export Format</h3>
                        <button class="btn-close" onclick="this.closest('.modal').remove(); window._resolveExportFormat('cancel')">×</button>
                    </div>
                    <div class="export-options">
                        <button class="btn-primary" onclick="this.closest('.modal').remove(); window._resolveExportFormat('pdf')">
                            Bank Statement (PDF)
                        </button>
                        <button class="btn-secondary" onclick="this.closest('.modal').remove(); window._resolveExportFormat('json')">
                            Raw Data (JSON)
                        </button>
                    </div>
                </div>
            `;
            
            // Setup resolver
            window._resolveExportFormat = (format) => {
                delete window._resolveExportFormat;
                resolve(format === 'cancel' ? null : format);
            };

            document.body.appendChild(dialog);
        });
    }
}

// Initialize UI
export const ui = new UIManager();
