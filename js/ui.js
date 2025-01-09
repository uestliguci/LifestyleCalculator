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
        
        // Initialize dynamic island
        this.dynamicIsland = document.getElementById('dynamic-island');
        
        // Load saved settings
        this.loadSettings();
        
        // Initialize event listeners after setup
        this.initializeEventListeners();
        
        // Initial section refresh
        this.refreshCurrentSection();
        
        // Show welcome message
        this.showDynamicIsland('Welcome to Lifestyle Calculator!');
    }

    async loadSettings() {
        const settings = localStorageManager.getSettings();
        
        // Apply theme
        if (settings.theme) {
            this.updateTheme(settings.theme, false);
        }
        
        // Apply currency
        if (settings.currency) {
            this.updateCurrency(settings.currency, false);
        }

        // Apply notification settings
        if ('notifications' in settings) {
            this.toggleDynamicIsland(settings.notifications, false);
        }

        // Update settings UI
        const themeSelect = document.querySelector('select[onchange="ui.updateTheme(this.value)"]');
        if (themeSelect) {
            themeSelect.value = settings.theme || 'system';
        }

        const currencySelect = document.querySelector('select[onchange="ui.updateCurrency(this.value)"]');
        if (currencySelect) {
            currencySelect.value = settings.currency || 'ALL';
        }

        const notificationToggle = document.querySelector('input[onchange="ui.toggleDynamicIsland(this.checked)"]');
        if (notificationToggle) {
            notificationToggle.checked = settings.notifications !== false;
        }
    }

    showDynamicIsland(message, icon = null, duration = 3000) {
        if (!this.dynamicIsland) return;

        // Update message
        const messageEl = this.dynamicIsland.querySelector('.message');
        if (messageEl) messageEl.textContent = message;

        // Update icon if provided
        if (icon) {
            const iconEl = this.dynamicIsland.querySelector('.icon svg');
            if (iconEl) iconEl.innerHTML = icon;
        }

        // Show the dynamic island
        this.dynamicIsland.classList.add('show');

        // Add haptic feedback if available
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(50);
        }

        // Hide after duration
        setTimeout(() => {
            this.dynamicIsland.classList.remove('show');
        }, duration);
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

        const settings = localStorageManager.getSettings();
        if (settings.budgetAlerts === false) return;

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

        // Check monthly budget limit
        if (settings.monthlyBudget && totalExpenses >= settings.monthlyBudget) {
            this.showAlert(`Monthly expenses have exceeded ${formatCurrency(settings.monthlyBudget)}`, 'warning');
            this.showDynamicIsland(
                `Budget Alert: Monthly limit exceeded`,
                '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>'
            );
        }

        // Check category budget limit
        const categoryBudget = settings.categoryBudgets?.[transaction.category];
        if (categoryBudget && categoryExpenses >= categoryBudget) {
            this.showAlert(`${transaction.category} expenses have exceeded ${formatCurrency(categoryBudget)}`, 'warning');
            this.showDynamicIsland(
                `Budget Alert: ${transaction.category} limit exceeded`,
                '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>'
            );
        }

        // Check predefined budget alerts
        for (const alert of BUDGET_ALERTS) {
            if (alert.type === 'total' && totalExpenses >= alert.threshold) {
                this.showAlert(alert.message, 'warning');
            } else if (alert.type === 'category' && 
                      alert.category === transaction.category && 
                      categoryExpenses >= alert.threshold) {
                this.showAlert(alert.message, 'warning');
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
        const items = document.querySelectorAll('.table-row');
        let startX, currentX, startY, currentY;
        const threshold = 50;
        let activeItem = null;
        let isScrolling = false;

        const resetAllItems = (exceptItem = null) => {
            items.forEach(item => {
                if (item !== exceptItem) {
                    item.style.transform = '';
                    item.classList.remove('swiped');
                    item.style.transition = 'transform 0.3s ease';
                }
            });
        };

        // Add touch feedback to all interactive elements
        const addTouchFeedback = () => {
            const interactiveElements = document.querySelectorAll('.action-button, .btn-edit, .btn-delete, .type-badge, .category-tag, .amount-tag');
            
            interactiveElements.forEach(element => {
                element.addEventListener('touchstart', () => {
                    element.style.transform = 'scale(0.95)';
                }, { passive: true });

                element.addEventListener('touchend', () => {
                    element.style.transform = '';
                }, { passive: true });

                element.addEventListener('touchcancel', () => {
                    element.style.transform = '';
                }, { passive: true });
            });
        };

        items.forEach(item => {
            const handleTouchStart = (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                currentX = startX;
                currentY = startY;
                item.style.transition = '';
                resetAllItems(item);
                isScrolling = undefined;
            };

            const handleTouchMove = (e) => {
                if (!startX) return;
                
                currentX = e.touches[0].clientX;
                currentY = e.touches[0].clientY;

                // Determine scroll vs swipe on first move
                if (isScrolling === undefined) {
                    const diffX = Math.abs(startX - currentX);
                    const diffY = Math.abs(startY - currentY);
                    isScrolling = diffY > diffX;
                }

                // If scrolling vertically, don't handle swipe
                if (isScrolling) return;

                const diff = currentX - startX;
                if (diff < 0 && diff > -120) {
                    e.preventDefault(); // Prevent scrolling when swiping
                    item.style.transform = `translateX(${diff}px)`;
                    activeItem = item;
                }
            };

            const handleTouchEnd = () => {
                if (!startX) return;
                
                item.style.transition = 'transform 0.3s ease';
                
                if (!isScrolling && startX - currentX > threshold) {
                    item.style.transform = 'translateX(-120px)';
                    item.classList.add('swiped');
                    
                    // Add haptic feedback if available
                    if (window.navigator && window.navigator.vibrate) {
                        window.navigator.vibrate(50);
                    }
                } else {
                    item.style.transform = '';
                    item.classList.remove('swiped');
                }
                
                startX = null;
                currentX = null;
                startY = null;
                currentY = null;
                isScrolling = undefined;
            };

            item.addEventListener('touchstart', handleTouchStart, { passive: true });
            item.addEventListener('touchmove', handleTouchMove, { passive: false }); // non-passive to prevent scroll
            item.addEventListener('touchend', handleTouchEnd, { passive: true });
            item.addEventListener('touchcancel', handleTouchEnd, { passive: true });
        });

        // Initialize touch feedback
        addTouchFeedback();

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
                
                // Show dynamic island notification
                const icon = transaction.type === 'income' ? 
                    '<path d="M12 3v18M5 10l7-7 7 7"/>' : 
                    '<path d="M12 21V3M5 14l7 7 7-7"/>';
                this.showDynamicIsland(
                    `${transaction.type === 'income' ? 'Income' : 'Expense'}: ${formatCurrency(transaction.amount)}`,
                    icon
                );
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
            this.showDynamicIsland('All data has been cleared', '<path d="M18 6L6 18M6 6l12 12"/>');
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

        // Calculate total balance
        const balance = transactions.reduce((total, t) => 
            total + (t.type.toLowerCase() === 'income' ? 1 : -1) * parseFloat(t.amount)
        , 0);

        // Group transactions by date
        const groupedTransactions = transactions.reduce((groups, t) => {
            const date = new Date(t.date).toLocaleDateString();
            if (!groups[date]) groups[date] = [];
            groups[date].push(t);
            return groups;
        }, {});

        // Create the transactions view
        transactionsList.innerHTML = `
            <div class="transactions-container">

                ${Object.entries(groupedTransactions).map(([date, dayTransactions]) => `
                    <div class="transaction-group">
                        <div class="transaction-date">
                            <span class="date-label">${new Date(date).toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                month: 'short', 
                                day: 'numeric'
                            })}</span>
                            <span class="date-total">
                                Daily Total: ${formatCurrency(dayTransactions.reduce((sum, t) => 
                                    sum + (t.type === 'income' ? 1 : -1) * parseFloat(t.amount), 0
                                ))}
                            </span>
                        </div>
                        <div class="transaction-table">
                            <div class="table-header">
                                <div class="col-type">Type</div>
                                <div class="col-category">Category</div>
                                <div class="col-description">Description</div>
                                <div class="col-time">Time</div>
                                <div class="col-amount">Amount</div>
                                <div class="col-actions">Actions</div>
                            </div>
                            ${dayTransactions.map(t => `
                                <div class="table-row" data-id="${t.id}">
                                    <div class="col-type">
                                        <div class="type-badge ${t.type.toLowerCase()}">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                ${t.type === 'income' ? 
                                                    '<path d="M12 3v18M5 10l7-7 7 7"/>' : 
                                                    '<path d="M12 21V3M5 14l7 7 7-7"/>'
                                                }
                                            </svg>
                                            <span>${t.type}</span>
                                        </div>
                                    </div>
                                    <div class="col-category">
                                        <span class="category-tag">${t.category}</span>
                                    </div>
                                    <div class="col-description">
                                        <span class="description-text">${t.description || 'No description'}</span>
                                    </div>
                                    <div class="col-time">
                                        ${new Date(t.date).toLocaleTimeString('en-US', { 
                                            hour: '2-digit', 
                                            minute: '2-digit'
                                        })}
                                    </div>
                                    <div class="col-amount">
                                        <span class="amount-tag ${t.type.toLowerCase()}">
                                            ${t.type === 'expense' ? '-' : '+'}${formatCurrency(t.amount)}
                                        </span>
                                    </div>
                                    <div class="col-actions">
                                        <button class="btn-delete" onclick="balanceManager.showDeleteConfirmation('${t.id}')">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Initialize swipe actions
        this.setupSwipeActions();

        // Initialize search functionality
        const searchInput = document.getElementById('search-transactions');
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => this.filterTransactions(e.target.value), 300));
        }
    }

    /**
     * Render settings section
     */
    renderSettings() {
        const settingsList = document.querySelector('.settings-list');
        if (settingsList) {
            settingsList.innerHTML = `
                <div class="settings-group">
                    <h3>Preferences</h3>
                    <div class="settings-item">
                        <div class="settings-info">
                            <h4>Currency</h4>
                            <p>Change your preferred currency</p>
                        </div>
                        <select class="settings-select" onchange="ui.updateCurrency(this.value)">
                            <option value="ALL">Albanian Lek (ALL)</option>
                            <option value="USD">US Dollar (USD)</option>
                            <option value="EUR">Euro (EUR)</option>
                            <option value="GBP">British Pound (GBP)</option>
                        </select>
                    </div>
                    <div class="settings-item">
                        <div class="settings-info">
                            <h4>Theme</h4>
                            <p>Choose your preferred appearance</p>
                        </div>
                        <select class="settings-select" onchange="ui.updateTheme(this.value)">
                            <option value="system">System Default</option>
                            <option value="light">Light Mode</option>
                            <option value="dark">Dark Mode</option>
                        </select>
                    </div>
                </div>

                <div class="settings-group">
                    <h3>Notifications</h3>
                    <div class="settings-item">
                        <div class="settings-info">
                            <h4>Budget Alerts</h4>
                            <p>Set monthly spending limits and get notified</p>
                        </div>
                        <button onclick="ui.showBudgetSettings()" class="btn-secondary">Configure</button>
                    </div>
                    <div class="settings-item">
                        <div class="settings-info">
                            <h4>Dynamic Island</h4>
                            <p>Show transaction notifications</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" checked onchange="ui.toggleDynamicIsland(this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <div class="settings-group">
                    <h3>Data Management</h3>
                    <div class="settings-item">
                        <div class="settings-info">
                            <h4>Export Statement</h4>
                            <p>Download your transaction history as PDF</p>
                        </div>
                        <button onclick="ui.exportData()" class="btn-primary">Export PDF</button>
                    </div>
                    <div class="settings-item">
                        <div class="settings-info">
                            <h4>Backup Data</h4>
                            <p>Save your data to a file</p>
                        </div>
                        <button onclick="ui.backupData()" class="btn-secondary">Backup</button>
                    </div>
                    <div class="settings-item">
                        <div class="settings-info">
                            <h4>Restore Data</h4>
                            <p>Restore from a backup file</p>
                        </div>
                        <button onclick="ui.restoreData()" class="btn-secondary">Restore</button>
                    </div>
                    <div class="settings-item">
                        <div class="settings-info">
                            <h4>Clear Data</h4>
                            <p>Reset all data and start fresh</p>
                        </div>
                        <button onclick="ui.clearData()" class="btn-danger">Clear Data</button>
                    </div>
                </div>

                <div class="settings-group">
                    <h3>About</h3>
                    <div class="settings-item">
                        <div class="settings-info">
                            <h4>Version</h4>
                            <p>Current version: 1.0.0</p>
                        </div>
                    </div>
                    <div class="settings-item">
                        <div class="settings-info">
                            <h4>Support</h4>
                            <p>Get help or report issues</p>
                        </div>
                        <button onclick="ui.showSupport()" class="btn-secondary">Contact</button>
                    </div>
                </div>
            `;
        }
    }

    updateCurrency(currency) {
        // Update currency in local storage
        localStorage.setItem('preferred_currency', currency);
        this.showDynamicIsland('Currency updated', '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>');
        this.refreshCurrentSection();
    }

    updateTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme_preference', theme);
        this.showDynamicIsland('Theme updated', '<path d="M20 15.31L23.31 12 20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69z"/>');
    }

    toggleDynamicIsland(enabled) {
        localStorage.setItem('dynamic_island_enabled', enabled);
        if (enabled) {
            this.showDynamicIsland('Notifications enabled', '<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>');
        } else {
            this.showDynamicIsland('Notifications disabled', '<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>');
        }
    }

    async backupData() {
        try {
            const data = await localStorageManager.getAllData();
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lifestyle-calculator-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showDynamicIsland('Backup created successfully', '<path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>');
        } catch (error) {
            console.error('Backup error:', error);
            this.showAlert('Failed to create backup', 'error');
        }
    }

    async restoreData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            try {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        await localStorageManager.restoreData(data);
                        this.showDynamicIsland('Data restored successfully', '<path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>');
                        this.refreshCurrentSection();
                    } catch (error) {
                        console.error('Restore error:', error);
                        this.showAlert('Invalid backup file', 'error');
                    }
                };
                reader.readAsText(file);
            } catch (error) {
                console.error('File read error:', error);
                this.showAlert('Failed to read backup file', 'error');
            }
        };
        input.click();
    }

    showBudgetSettings() {
        const settings = localStorageManager.getSettings();
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Budget Settings</h3>
                    <button class="btn-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <form class="ios-form" onsubmit="ui.saveBudgetSettings(event)">
                    <div class="form-group">
                        <label>Monthly Spending Limit</label>
                        <input type="number" id="monthly-limit" class="ios-input" required min="0" step="0.01" 
                               value="${settings.monthlyBudget || 0}">
                    </div>
                    <div class="form-group">
                        <label>Category Limits</label>
                        <div id="category-limits">
                            ${Object.entries(CATEGORIES.expense || {}).map(([category]) => `
                                <div class="category-budget-item">
                                    <label>${category}</label>
                                    <input type="number" name="category-${category}" 
                                           class="ios-input" min="0" step="0.01"
                                           value="${settings.categoryBudgets?.[category] || 0}">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="budget-alerts" 
                                   ${settings.budgetAlerts !== false ? 'checked' : ''}>
                            Enable budget alerts
                        </label>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Save Settings</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    }

    async saveBudgetSettings(event) {
        event.preventDefault();
        const form = event.target;
        
        try {
            const settings = {
                monthlyBudget: parseFloat(form.querySelector('#monthly-limit').value) || 0,
                budgetAlerts: form.querySelector('#budget-alerts').checked,
                categoryBudgets: {}
            };

            // Get category budgets
            const categoryInputs = form.querySelectorAll('[name^="category-"]');
            categoryInputs.forEach(input => {
                const category = input.name.replace('category-', '');
                settings.categoryBudgets[category] = parseFloat(input.value) || 0;
            });

            await localStorageManager.updateBudgetSettings(settings);
            this.showDynamicIsland('Budget settings updated', '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>');
            form.closest('.modal').remove();
        } catch (error) {
            console.error('Error saving budget settings:', error);
            this.showAlert('Failed to save budget settings', 'error');
        }
    }

    showSupport() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Support</h3>
                    <button class="btn-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-message">
                    <p>For support or to report issues, please contact:</p>
                    <p><a href="mailto:support@example.com">support@example.com</a></p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
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
