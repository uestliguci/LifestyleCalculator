import { postgresStorage } from './postgres-storage.js';
import { chartManager } from '../charts.js';

class AnalyticsService {
    constructor() {
        this.currentPeriod = 'week';
        this.chartUpdateInterval = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        // Set up period selector listeners
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const period = e.target.dataset.period;
                this.switchPeriod(period);
            });
        });

        // Initialize with weekly data
        await this.updateAnalytics('week');
        this.isInitialized = true;

        // Set up auto-refresh for real-time updates
        this.setupAutoRefresh();
    }

    async switchPeriod(period) {
        if (this.currentPeriod === period) return;

        // Update UI
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.period === period);
        });

        // Update data
        this.currentPeriod = period;
        await this.updateAnalytics(period);
    }

    async updateAnalytics(period) {
        try {
            const transactions = await postgresStorage.getAllTransactions();
            if (!transactions || transactions.length === 0) {
                this.showNoDataMessage();
                return;
            }

            const periodData = this.filterTransactionsByPeriod(transactions, period);
            const previousPeriodData = this.filterTransactionsByPeriod(transactions, period, true);

            // Update summary cards
            this.updateSummaryCards(periodData, previousPeriodData);

            // Update charts with iOS-optimized rendering
            await this.updateCharts(periodData);

        } catch (error) {
            console.error('Failed to update analytics:', error);
            this.showError('Failed to update analytics. Please try again.');
        }
    }

    filterTransactionsByPeriod(transactions, period, isPrevious = false) {
        const now = new Date();
        let startDate = new Date();
        let endDate = new Date();

        switch (period) {
            case 'week':
                startDate.setDate(now.getDate() - (isPrevious ? 14 : 7));
                endDate = isPrevious ? new Date(startDate) : now;
                if (isPrevious) startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(now.getMonth() - (isPrevious ? 2 : 1));
                endDate = isPrevious ? new Date(startDate) : now;
                if (isPrevious) startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'year':
                startDate.setFullYear(now.getFullYear() - (isPrevious ? 2 : 1));
                endDate = isPrevious ? new Date(startDate) : now;
                if (isPrevious) startDate.setFullYear(startDate.getFullYear() - 1);
                break;
        }

        return transactions.filter(t => {
            const date = new Date(t.date);
            return date >= startDate && date <= endDate;
        });
    }

    updateSummaryCards(currentData, previousData) {
        const formatAmount = (amount) => amount.toFixed(2);
        const calculateTrend = (current, previous) => {
            if (!previous) return 0;
            return ((current - previous) / previous) * 100;
        };

        // Calculate totals
        const currentTotals = this.calculateTotals(currentData);
        const previousTotals = this.calculateTotals(previousData);

        // Update income card
        const incomeCard = document.querySelector('.analytics-card.income');
        const incomeTrend = calculateTrend(currentTotals.income, previousTotals.income);
        incomeCard.querySelector('.amount').textContent = `Lek ${formatAmount(currentTotals.income)}`;
        incomeCard.querySelector('.trend').textContent = `${incomeTrend >= 0 ? '+' : ''}${formatAmount(incomeTrend)}% from last period`;
        incomeCard.querySelector('.trend').className = `trend ${incomeTrend >= 0 ? 'positive' : 'negative'}`;

        // Update expense card
        const expenseCard = document.querySelector('.analytics-card.expense');
        const expenseTrend = calculateTrend(currentTotals.expenses, previousTotals.expenses);
        expenseCard.querySelector('.amount').textContent = `Lek ${formatAmount(currentTotals.expenses)}`;
        expenseCard.querySelector('.trend').textContent = `${expenseTrend >= 0 ? '+' : ''}${formatAmount(expenseTrend)}% from last period`;
        expenseCard.querySelector('.trend').className = `trend ${expenseTrend <= 0 ? 'positive' : 'negative'}`;

        // Update savings card
        const savingsCard = document.querySelector('.analytics-card.savings');
        const netSavings = currentTotals.income - currentTotals.expenses;
        const savingsRate = currentTotals.income > 0 ? (netSavings / currentTotals.income) * 100 : 0;
        savingsCard.querySelector('.amount').textContent = `Lek ${formatAmount(netSavings)}`;
        savingsCard.querySelector('.trend').textContent = `${formatAmount(savingsRate)}% savings rate`;
        savingsCard.querySelector('.trend').className = `trend ${savingsRate >= 20 ? 'positive' : savingsRate >= 10 ? '' : 'negative'}`;
    }

    async updateCharts(transactions) {
        // Category distribution chart
        const categoryData = this.aggregateByCategory(transactions);
        await chartManager.updateCategoryChart(categoryData);

        // Spending trend chart
        const trendData = this.aggregateByDate(transactions);
        await chartManager.updateTrendChart(trendData);

        // Update summary statistics
        this.updateChartSummary(transactions);
    }

    aggregateByCategory(transactions) {
        const categories = {};
        transactions.forEach(t => {
            if (t.type.toLowerCase() === 'expense') {
                categories[t.category] = (categories[t.category] || 0) + parseFloat(t.amount);
            }
        });

        // Sort by amount and get top categories
        return Object.entries(categories)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 6)
            .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {});
    }

    aggregateByDate(transactions) {
        const dailyTotals = {};
        transactions.forEach(t => {
            const date = new Date(t.date).toISOString().split('T')[0];
            if (!dailyTotals[date]) {
                dailyTotals[date] = { income: 0, expenses: 0 };
            }
            if (t.type.toLowerCase() === 'income') {
                dailyTotals[date].income += parseFloat(t.amount);
            } else {
                dailyTotals[date].expenses += parseFloat(t.amount);
            }
        });

        return Object.entries(dailyTotals)
            .sort(([a], [b]) => new Date(a) - new Date(b))
            .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {});
    }

    updateChartSummary(transactions) {
        const expenseTransactions = transactions.filter(t => t.type.toLowerCase() === 'expense');
        const totalDays = this.getDaysBetween(transactions);
        
        // Calculate average daily spending
        const totalSpending = expenseTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const avgDailySpending = totalDays > 0 ? totalSpending / totalDays : 0;
        document.getElementById('avg-daily-spending').textContent = `Lek ${avgDailySpending.toFixed(2)}`;

        // Find day with maximum spending
        const dailyTotals = {};
        expenseTransactions.forEach(t => {
            const date = new Date(t.date).toISOString().split('T')[0];
            dailyTotals[date] = (dailyTotals[date] || 0) + parseFloat(t.amount);
        });

        const maxSpendingDay = Object.entries(dailyTotals)
            .sort(([,a], [,b]) => b - a)[0];

        if (maxSpendingDay) {
            const [date, amount] = maxSpendingDay;
            document.getElementById('max-spending-day').textContent = 
                `${new Date(date).toLocaleDateString()} (Lek ${amount.toFixed(2)})`;
        }
    }

    calculateTotals(transactions) {
        return transactions.reduce((acc, t) => {
            const amount = parseFloat(t.amount);
            if (t.type.toLowerCase() === 'income') {
                acc.income += amount;
            } else {
                acc.expenses += amount;
            }
            return acc;
        }, { income: 0, expenses: 0 });
    }

    getDaysBetween(transactions) {
        if (!transactions.length) return 0;
        const dates = transactions.map(t => new Date(t.date));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        return Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
    }

    showNoDataMessage() {
        const cards = document.querySelectorAll('.analytics-card');
        cards.forEach(card => {
            card.querySelector('.amount').textContent = 'Lek 0.00';
            card.querySelector('.trend').textContent = 'No data available';
            card.querySelector('.trend').className = 'trend';
        });

        chartManager.clearCharts();
    }

    showError(message) {
        // Implement error display logic
        console.error(message);
    }

    setupAutoRefresh() {
        // Clear existing interval if any
        if (this.chartUpdateInterval) {
            clearInterval(this.chartUpdateInterval);
        }

        // Update every 5 minutes
        this.chartUpdateInterval = setInterval(() => {
            this.updateAnalytics(this.currentPeriod);
        }, 5 * 60 * 1000);
    }

    destroy() {
        if (this.chartUpdateInterval) {
            clearInterval(this.chartUpdateInterval);
        }
    }
}

export const analyticsService = new AnalyticsService();
