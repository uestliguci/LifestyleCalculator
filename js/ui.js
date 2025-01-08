import { ANIMATION_DURATION, BUDGET_ALERTS, CATEGORIES } from './config.js';
import { localStorageManager } from './services/local-storage-manager.js';
import { formatCurrency, formatDate, debounce, detectAnomalies } from './utils.js';
import { chartManager } from './charts.js';
import { exportToPDF } from './services/pdf-export.js';
import { balanceManager } from './services/balance-manager.js';

/**
 * UI Manager class to handle all UI-related operations
 */
class UIManager {
    constructor() {
        this.currentSection = 'transactions';
        this.initializeDB();
        this.addSectionTransitionStyles();
        
        // Set UI reference in balance manager
        balanceManager.setUI(this);
        
        // Initialize event listeners after setup
        this.initializeEventListeners();
        
        // Initial section refresh
        this.refreshCurrentSection();
    }

    async getChartManager() {
        if (!this.chartManager) {
            await new Promise((resolve, reject) => {
                let attempts = 0;
                const maxAttempts = 50;

                const checkDependencies = () => {
                    attempts++;
                    if (window.Chart && window.chartManager) {
                        this.chartManager = window.chartManager;
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        reject(new Error('Failed to initialize chart manager'));
                    } else {
                        setTimeout(checkDependencies, 100);
                    }
                };
                checkDependencies();
            });
        }
        return this.chartManager;
    }

    async initializeDB() {
        console.log('Storage system initialized successfully');
    }

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
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateAnalytics(btn.dataset.period);
            });
        });

        // Chart Export Controls
        document.querySelectorAll('.btn-export').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const chartSection = e.currentTarget.closest('.chart-section');
                if (chartSection) {
                    const chartId = chartSection.querySelector('canvas').id;
                    const title = chartSection.querySelector('h4').textContent;
                    try {
                        const chartManager = await this.getChartManager();
                        const chart = chartManager.charts.get(chartId);
                        if (!chart) {
                            throw new Error('Chart not found');
                        }
                        await chartManager.exportChartAsPDF(chartId, title);
                        this.showAlert('Chart exported successfully', 'success');
                    } catch (error) {
                        console.error('Chart export error:', error);
                        this.showAlert(error.message || 'Failed to export chart', 'error');
                    }
                }
            });
        });

        // Initialize swipe actions
        this.setupSwipeActions();
    }

    async checkBudgetAlerts(transaction) {
        if (transaction.type !== 'expense') return;

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const transactions = await localStorageManager.getTransactions();
        const monthlyTransactions = transactions.filter(t => 
            new Date(t.date) >= monthStart && t.type === 'expense'
        );

        const totalExpenses = monthlyTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const categoryExpenses = monthlyTransactions
            .filter(t => t.category === transaction.category)
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        for (const alert of BUDGET_ALERTS) {
            if (alert.type === 'total' && totalExpenses >= alert.threshold) {
                this.showAlert(`Monthly expenses have exceeded ${formatCurrency(alert.threshold)}`, 'warning');
            } else if (alert.type === 'category' && 
                      alert.category === transaction.category && 
                      categoryExpenses >= alert.threshold) {
                this.showAlert(`${transaction.category} expenses have exceeded ${formatCurrency(alert.threshold)}`, 'warning');
            }
        }
    }

    updateCategoryOptions(type) {
        const categorySelect = document.getElementById('category');
        if (!categorySelect) return;

        const categories = CATEGORIES[type.toLowerCase()] || [];
        categorySelect.innerHTML = categories.map(category => 
            `<option value="${category}">${category}</option>`
        ).join('');
    }

    async switchSection(sectionId) {
        document.querySelectorAll('.tab-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.menu === sectionId);
        });

        document.querySelectorAll('.menu-section').forEach(section => {
            if (section.id === sectionId) {
                section.style.display = 'block';
                setTimeout(() => section.classList.add('active'), 50);
            } else {
                section.classList.remove('active');
                setTimeout(() => {
                    if (!section.classList.contains('active')) {
                        section.style.display = 'none';
                    }
                }, 300);
            }
        });

        this.currentSection = sectionId;

        const sectionTitle = document.querySelector('.section-title');
        if (sectionTitle) {
            sectionTitle.textContent = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
        }

        await this.refreshCurrentSection();
    }

    setupSwipeActions() {
        const items = document.querySelectorAll('.transaction-item');
        let startX, currentX;
        const threshold = 50;
        let activeItem = null;

        const resetAllItems = (exceptItem = null) => {
            items.forEach(item => {
                if (item !== exceptItem) {
                    item.style.transform = '';
                    item.classList.remove('swiped');
                    item.style.transition = 'transform 0.3s ease';
                }
            });
        };

        items.forEach(item => {
            const handleTouchStart = (e) => {
                startX = e.touches[0].clientX;
                currentX = startX;
                item.style.transition = '';
                resetAllItems(item);
            };

            const handleTouchMove = (e) => {
                if (!startX) return;
                currentX = e.touches[0].clientX;
                const diff = currentX - startX;
                if (diff < 0 && diff > -120) {
                    item.style.transform = `translateX(${diff}px)`;
                    activeItem = item;
                }
            };

            const handleTouchEnd = () => {
                if (!startX) return;
                item.style.transition = 'transform 0.3s ease';
                if (startX - currentX > threshold) {
                    item.style.transform = 'translateX(-120px)';
                    item.classList.add('swiped');
                } else {
                    item.style.transform = '';
                    item.classList.remove('swiped');
                }
                startX = null;
                currentX = null;
            };

            item.addEventListener('touchstart', handleTouchStart);
            item.addEventListener('touchmove', handleTouchMove);
            item.addEventListener('touchend', handleTouchEnd);
            item.addEventListener('touchcancel', handleTouchEnd);
        });

        document.addEventListener('touchstart', (e) => {
            if (activeItem && !activeItem.contains(e.target)) {
                resetAllItems();
                activeItem = null;
            }
        });
    }

    async refreshCurrentSection() {
        try {
            await this.updateBalanceIndicator();

            switch (this.currentSection) {
                case 'transactions':
                    await this.renderTransactionList();
                    break;
                case 'analytics':
                    await this.updateAnalytics();
                    break;
                case 'settings':
                    this.renderSettings();
                    break;
            }
        } catch (error) {
            console.error('Section refresh error:', error);
            this.showAlert('Failed to refresh section', 'error');
        }
    }

    async handleTransactionSubmit(e) {
        e.preventDefault();
        
        try {
            const form = e.target;
            const now = new Date();
            const formattedDate = now.toISOString().replace(/\.\d+/, '.000');
            
            const transaction = {
                type: form.querySelector('#transaction-type').value,
                amount: parseFloat(form.querySelector('#amount').value),
                category: form.querySelector('#category').value,
                description: form.querySelector('#description').value || '',
                date: formattedDate,
                timestamp: formattedDate,
                id: now.getTime().toString(36)
            };

            console.log('Submitting transaction:', transaction);
            const result = await localStorageManager.addTransaction(transaction);
            
            if (result.success) {
                this.showAlert('Transaction added successfully', 'success');
                form.reset();
                await this.updateBalanceIndicator();
                await this.checkBudgetAlerts(transaction);
                document.getElementById('add-transaction-modal').style.display = 'none';
            } else {
                const errorMessages = result.errors ? Object.values(result.errors).join(', ') : result.message;
                this.showAlert(`Failed to add transaction: ${errorMessages}`, 'error');
            }
        } catch (error) {
            console.error('Transaction submission error:', error);
            this.showAlert('Failed to add transaction', 'error');
        }
    }

    async filterTransactions(query) {
        const transactions = await localStorageManager.getTransactions();
        const filtered = transactions.filter(t => 
            Object.values(t).some(value => 
                String(value).toLowerCase().includes(query.toLowerCase())
            )
        );
        this.renderTransactionList(filtered);
    }

    async updateAnalytics(period = 'week') {
        const transactions = await localStorageManager.getTransactions();
        const now = new Date();
        let startDate;

        switch (period) {
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            case 'year':
                startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                break;
        }

        const currentPeriodTransactions = transactions.filter(t => new Date(t.date) >= startDate);
        const previousStartDate = new Date(startDate);
        switch (period) {
            case 'week':
                previousStartDate.setDate(previousStartDate.getDate() - 7);
                break;
            case 'month':
                previousStartDate.setMonth(previousStartDate.getMonth() - 1);
                break;
            case 'year':
                previousStartDate.setFullYear(previousStartDate.getFullYear() - 1);
                break;
        }

        const previousPeriodTransactions = transactions.filter(t => 
            new Date(t.date) >= previousStartDate && new Date(t.date) < startDate
        );

        const currentStats = this.calculatePeriodStats(currentPeriodTransactions);
        const previousStats = this.calculatePeriodStats(previousPeriodTransactions);

        const cards = document.querySelector('.analytics-cards');
        if (cards) {
            cards.innerHTML = `
                <div class="analytics-card income">
                    <h4>Total Income</h4>
                    <div class="amount">${formatCurrency(currentStats.income)}</div>
                    <div class="trend ${this.getTrendClass(currentStats.income, previousStats.income)}">
                        ${this.calculateTrendPercentage(currentStats.income, previousStats.income)}
                    </div>
                </div>
                <div class="analytics-card expense">
                    <h4>Total Expenses</h4>
                    <div class="amount">${formatCurrency(currentStats.expenses)}</div>
                    <div class="trend ${this.getTrendClass(previousStats.expenses, currentStats.expenses)}">
                        ${this.calculateTrendPercentage(currentStats.expenses, previousStats.expenses)}
                    </div>
                </div>
                <div class="analytics-card savings">
                    <h4>Net Savings</h4>
                    <div class="amount">${formatCurrency(currentStats.savings)}</div>
                    <div class="trend">
                        ${currentStats.savingsRate.toFixed(1)}% savings rate
                    </div>
                </div>
            `;
        }

        try {
            const chartManager = await this.getChartManager();
            await chartManager.updateCategoryChart('category-chart', currentPeriodTransactions);
            await chartManager.updateTrendChart('trend-chart', currentPeriodTransactions, period);
        } catch (error) {
            console.error('Failed to update charts:', error);
            this.showAlert('Failed to update charts', 'error');
        }

        const categoryLegend = document.getElementById('category-legend');
        if (categoryLegend) {
            const categoryTotals = currentPeriodTransactions
                .filter(t => t.type === 'expense')
                .reduce((acc, t) => {
                    acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
                    return acc;
                }, {});

            const sortedCategories = Object.entries(categoryTotals)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 6);

            const total = sortedCategories.reduce((sum, [,amount]) => sum + amount, 0);

            categoryLegend.innerHTML = sortedCategories.map(([category, amount], index) => `
                <div class="legend-item">
                    <div class="legend-color" style="background: ${['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5'][index]}"></div>
                    <div class="legend-label">${category}</div>
                    <div class="legend-value">${((amount / total) * 100).toFixed(1)}%</div>
                </div>
            `).join('');
        }

        const avgSpending = document.getElementById('avg-daily-spending');
        const maxSpendingDay = document.getElementById('max-spending-day');
        
        if (avgSpending && maxSpendingDay) {
            const dailyExpenses = currentPeriodTransactions
                .filter(t => t.type === 'expense')
                .reduce((acc, t) => {
                    const date = new Date(t.date).toLocaleDateString();
                    acc[date] = (acc[date] || 0) + parseFloat(t.amount);
                    return acc;
                }, {});

            const days = Object.keys(dailyExpenses).length || 1;
            const totalExpenses = Object.values(dailyExpenses).reduce((sum, amount) => sum + amount, 0);
            const averageDaily = totalExpenses / days;

            const maxDay = Object.entries(dailyExpenses)
                .sort(([,a], [,b]) => b - a)[0];

            avgSpending.textContent = formatCurrency(averageDaily);
            maxSpendingDay.textContent = maxDay ? 
                `${new Date(maxDay[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${formatCurrency(maxDay[1])})` : 
                '-';
        }

        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.period === period);
        });
    }

    calculatePeriodStats(transactions) {
        const stats = transactions.reduce((acc, t) => {
            const amount = parseFloat(t.amount);
            if (t.type === 'income') {
                acc.income += amount;
            } else {
                acc.expenses += amount;
            }
            return acc;
        }, { income: 0, expenses: 0 });

        stats.savings = stats.income - stats.expenses;
        stats.savingsRate = stats.income > 0 ? (stats.savings / stats.income) * 100 : 0;

        return stats;
    }

    getTrendClass(current, previous) {
        if (current === previous) return '';
        return current > previous ? 'positive' : 'negative';
    }

    calculateTrendPercentage(current, previous) {
        if (previous === 0) return current > 0 ? '+100% from last period' : '0% from last period';
        const percentage = ((current - previous) / previous) * 100;
        const sign = percentage > 0 ? '+' : '';
        return `${sign}${percentage.toFixed(1)}% from last period`;
    }

    async updateBalanceIndicator() {
        const transactions = await localStorageManager.getTransactions();
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
     * Clear all data
     */
    async clearData() {
        try {
            await localStorageManager.clearData();
            this.showAlert('All data cleared successfully', 'success');
            await this.refreshCurrentSection();
        } catch (error) {
            console.error('Failed to clear data:', error);
            this.showAlert('Failed to clear data', 'error');
        }
    }

    /**
     * Export bank statement as PDF
     */
    async exportData() {
        try {
            // Use the same PDF export logic for both bank statement and regular export
            await exportToPDF();
            this.showAlert('Bank statement exported successfully', 'success');
            
            // Track export event
            if (window.gtag) {
                window.gtag('event', 'export_statement', {
                    'event_category': 'user_action',
                    'event_label': 'bank_statement'
                });
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showAlert('Failed to export bank statement', 'error');
        }
    }

    /**
     * Render transaction list in iOS style
     */
    async renderTransactionList(transactions = null) {
        const transactionsList = document.getElementById('transactions-list');
        if (!transactionsList) return;

        if (!transactions) {
            transactions = await localStorageManager.getTransactions();
        }

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
                    <div class="transaction-item" data-id="${t.id}">
                        <div class="transaction-info">
                            <div class="transaction-title">${t.category}</div>
                            <div class="transaction-details">
                                <span class="transaction-type ${t.type.toLowerCase()}">${t.type}</span>
                                <span class="transaction-description">${t.description || 'No description'}</span>
                            </div>
                        </div>
                        <div class="transaction-amount ${t.type.toLowerCase()}">
                            ${t.type === 'expense' ? '-' : '+'}${formatCurrency(t.amount)}
                        </div>
                        <div class="transaction-actions">
                            <button class="btn-edit" onclick="balanceManager.showEditModal('${t.id}')">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="btn-delete" onclick="balanceManager.showDeleteConfirmation('${t.id}')">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');

        // Initialize swipe actions
        this.setupSwipeActions();
    }

    /**
     * Render settings section
     */
    renderSettings() {
        const settingsList = document.querySelector('.settings-list');
        if (settingsList) {
            settingsList.innerHTML = `
                <div class="settings-item">
                    <div class="settings-info">
                        <h4>Bank Statement</h4>
                        <p>Download your transaction history as a professional bank statement</p>
                    </div>
                    <button onclick="ui.exportData()" class="btn-primary">Download Statement</button>
                </div>
                <div class="settings-item">
                    <div class="settings-info">
                        <h4>Clear Data</h4>
                        <p>Reset all data and start fresh</p>
                    </div>
                    <button onclick="ui.clearData()" class="btn-secondary">Clear Data</button>
                </div>
            `;
        }
    }

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
}

// Create and export UI instance
const uiManager = new UIManager();
export const ui = uiManager;

// Make UI instance globally available
window.ui = uiManager;
