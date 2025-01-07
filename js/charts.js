import { CHART_COLORS, CHART_CONFIG } from './config.js';
import { formatCurrency, formatDate, groupTransactionsByPeriod } from './utils.js';

/**
 * Chart manager class to handle all chart-related operations
 */
class ChartManager {
    constructor() {
        this.charts = new Map();
    }

    /**
     * Create or update category breakdown chart
     * @param {string} canvasId - Canvas element ID
     * @param {Array} transactions - Transaction data
     */
    updateCategoryChart(canvasId, transactions) {
        const categoryData = this.calculateCategoryData(transactions);

        const config = {
            ...CHART_CONFIG,
            type: 'doughnut',
            data: {
                labels: categoryData.labels,
                datasets: [{
                    data: categoryData.values,
                    backgroundColor: this.generateColors(categoryData.labels.length),
                    borderWidth: 1
                }]
            },
            options: {
                ...CHART_CONFIG.plugins,
                cutout: '60%',
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${formatCurrency(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        };

        this.createOrUpdateChart(canvasId, config);
    }

    /**
     * Create or update spending trend chart
     * @param {string} canvasId - Canvas element ID
     * @param {Array} transactions - Transaction data
     * @param {string} period - Time period ('daily', 'weekly', 'monthly')
     */
    updateTrendChart(canvasId, transactions, period) {
        const groupedData = groupTransactionsByPeriod(transactions, period);
        const labels = Object.keys(groupedData).sort();
        
        const incomeData = labels.map(date => 
            groupedData[date]
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + parseFloat(t.amount), 0)
        );

        const expenseData = labels.map(date => 
            groupedData[date]
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + parseFloat(t.amount), 0)
        );

        const config = {
            ...CHART_CONFIG,
            type: 'line',
            data: {
                labels: labels.map(date => formatDate(date)),
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData,
                        borderColor: CHART_COLORS.income,
                        backgroundColor: CHART_COLORS.income + '40',
                        fill: true
                    },
                    {
                        label: 'Expenses',
                        data: expenseData,
                        borderColor: CHART_COLORS.expense,
                        backgroundColor: CHART_COLORS.expense + '40',
                        fill: true
                    }
                ]
            },
            options: {
                ...CHART_CONFIG.plugins,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => formatCurrency(value)
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        };

        this.createOrUpdateChart(canvasId, config);
    }

    /**
     * Create or update balance sheet chart
     * @param {string} canvasId - Canvas element ID
     * @param {Array} transactions - Transaction data
     */
    updateBalanceChart(canvasId, transactions) {
        const monthlyData = this.calculateMonthlyBalances(transactions);

        const config = {
            ...CHART_CONFIG,
            type: 'bar',
            data: {
                labels: monthlyData.labels,
                datasets: [
                    {
                        label: 'Net Balance',
                        data: monthlyData.balances,
                        backgroundColor: monthlyData.balances.map(value => 
                            value >= 0 ? CHART_COLORS.income : CHART_COLORS.expense
                        ),
                        order: 2
                    },
                    {
                        label: 'Trend',
                        data: monthlyData.balances,
                        type: 'line',
                        borderColor: CHART_COLORS.neutral,
                        fill: false,
                        tension: 0.4,
                        order: 1
                    }
                ]
            },
            options: {
                ...CHART_CONFIG.plugins,
                scales: {
                    y: {
                        ticks: {
                            callback: value => formatCurrency(value)
                        }
                    }
                }
            }
        };

        this.createOrUpdateChart(canvasId, config);
    }

    /**
     * Create or update savings analysis chart
     * @param {string} canvasId - Canvas element ID
     * @param {Array} transactions - Transaction data
     */
    updateSavingsChart(canvasId, transactions) {
        const savingsData = this.calculateSavingsData(transactions);

        const config = {
            ...CHART_CONFIG,
            type: 'line',
            data: {
                labels: savingsData.labels,
                datasets: [{
                    label: 'Savings Rate',
                    data: savingsData.rates,
                    borderColor: CHART_COLORS.neutral,
                    backgroundColor: CHART_COLORS.neutral + '40',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                ...CHART_CONFIG.plugins,
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        ticks: {
                            callback: value => value + '%'
                        }
                    }
                }
            }
        };

        this.createOrUpdateChart(canvasId, config);
    }

    /**
     * Calculate category breakdown data
     * @param {Array} transactions - Transaction data
     * @returns {Object} Category labels and values
     */
    calculateCategoryData(transactions) {
        const categoryTotals = transactions.reduce((acc, transaction) => {
            const { category, amount, type } = transaction;
            if (!acc[category]) {
                acc[category] = 0;
            }
            acc[category] += type === 'expense' ? parseFloat(amount) : 0;
            return acc;
        }, {});

        return {
            labels: Object.keys(categoryTotals),
            values: Object.values(categoryTotals)
        };
    }

    /**
     * Calculate monthly balance data
     * @param {Array} transactions - Transaction data
     * @returns {Object} Monthly labels and balance values
     */
    calculateMonthlyBalances(transactions) {
        const monthlyData = groupTransactionsByPeriod(transactions, 'month');
        const sortedMonths = Object.keys(monthlyData).sort();

        const balances = sortedMonths.map(month => {
            const monthTransactions = monthlyData[month];
            return monthTransactions.reduce((balance, t) => 
                balance + (t.type === 'income' ? 1 : -1) * parseFloat(t.amount)
            , 0);
        });

        return {
            labels: sortedMonths.map(month => formatDate(month, 'MMM YYYY')),
            balances
        };
    }

    /**
     * Calculate savings rate data
     * @param {Array} transactions - Transaction data
     * @returns {Object} Monthly labels and savings rate values
     */
    calculateSavingsData(transactions) {
        const monthlyData = groupTransactionsByPeriod(transactions, 'month');
        const sortedMonths = Object.keys(monthlyData).sort();

        const rates = sortedMonths.map(month => {
            const monthTransactions = monthlyData[month];
            const income = monthTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + parseFloat(t.amount), 0);
            const expenses = monthTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + parseFloat(t.amount), 0);
            
            return income > 0 ? ((income - expenses) / income) * 100 : 0;
        });

        return {
            labels: sortedMonths.map(month => formatDate(month, 'MMM YYYY')),
            rates
        };
    }

    /**
     * Generate colors for chart segments
     * @param {number} count - Number of colors needed
     * @returns {Array} Array of color strings
     */
    generateColors(count) {
        const baseColors = [
            '#2ecc71', '#e74c3c', '#3498db', '#f1c40f', '#9b59b6',
            '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
        ];

        if (count <= baseColors.length) {
            return baseColors.slice(0, count);
        }

        // Generate additional colors if needed
        const colors = [...baseColors];
        while (colors.length < count) {
            const hue = (colors.length * 137.508) % 360;
            colors.push(`hsl(${hue}, 70%, 50%)`);
        }
        return colors;
    }

    /**
     * Create a new chart or update existing one
     * @param {string} canvasId - Canvas element ID
     * @param {Object} config - Chart configuration
     */
    createOrUpdateChart(canvasId, config) {
        if (this.charts.has(canvasId)) {
            const chart = this.charts.get(canvasId);
            chart.data = config.data;
            chart.options = config.options;
            chart.update('none');
        } else {
            const chart = new Chart(document.getElementById(canvasId), config);
            this.charts.set(canvasId, chart);
        }
    }

    /**
     * Destroy all charts
     */
    destroyAllCharts() {
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }
}

export const chartManager = new ChartManager();
