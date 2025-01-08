import { formatCurrency } from './utils.js';

class ChartManager {
    constructor() {
        this.charts = new Map();
        this.initialized = false;
        
        // Initialize async
        this.initializeAsync();
    }

    async initializeAsync() {
        try {
            // Wait for Chart.js to be available
            while (!window.Chart) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.setupChartDefaults();
            this.initialized = true;
            console.log('Chart manager initialized with defaults');
        } catch (error) {
            console.error('Failed to initialize chart manager:', error);
        }
    }

    setupChartDefaults() {
        if (!window.Chart) return;

        // iOS-optimized defaults
        Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Icons", "Helvetica Neue", sans-serif';
        Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
        Chart.defaults.scale.grid.color = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim();
        Chart.defaults.plugins.tooltip.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--surface-color-dark').trim();
        Chart.defaults.plugins.tooltip.titleColor = '#fff';
        Chart.defaults.plugins.tooltip.bodyColor = '#fff';
        Chart.defaults.plugins.tooltip.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim();
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.padding = 12;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
        Chart.defaults.plugins.tooltip.displayColors = false; // iOS-style tooltips
        Chart.defaults.plugins.tooltip.intersect = false;
        Chart.defaults.plugins.tooltip.mode = 'nearest';
        
        // iOS performance optimizations
        Chart.defaults.animation.duration = 250; // Faster animations
        Chart.defaults.hover.animationDuration = 0; // Instant hover state
        Chart.defaults.responsiveAnimationDuration = 0; // Instant resize
        Chart.defaults.elements.point.hitRadius = 20; // Larger touch targets
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initializeAsync();
        }
    }

    async updateCategoryChart(canvasId, transactions) {
        await this.ensureInitialized();
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.has(canvasId)) {
            this.charts.get(canvasId).destroy();
        }

        // Calculate category totals
        const categoryTotals = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
                return acc;
            }, {});

        // Sort categories by amount
        const sortedCategories = Object.entries(categoryTotals)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 6); // Show top 6 categories

        const data = {
            labels: sortedCategories.map(([category]) => category),
            datasets: [{
                data: sortedCategories.map(([,amount]) => amount),
                backgroundColor: [
                    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5'
                ],
                borderWidth: 0,
                borderRadius: 8
            }]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${formatCurrency(context.raw)} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 250 // Faster animations for iOS
            },
            // iOS touch optimizations
            events: ['touchstart', 'touchmove', 'click'],
            onHover: null, // Disable hover effects for better performance
            onClick: (e, elements) => {
                if (elements && elements.length > 0) {
                    const index = elements[0].index;
                    const label = data.labels[index];
                    const value = data.datasets[0].data[index];
                    // Show native iOS tooltip
                    if (window.navigator.userAgent.match(/(iPad|iPhone|iPod)/g)) {
                        alert(`${label}: ${formatCurrency(value)}`);
                    }
                }
            }
        };

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: options
        });

        this.charts.set(canvasId, chart);
    }

    async updateTrendChart(canvasId, transactions, period = 'week') {
        await this.ensureInitialized();
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.has(canvasId)) {
            this.charts.get(canvasId).destroy();
        }

        // Group transactions by date
        const groupedData = this.groupTransactionsByPeriod(transactions, period);
        const dates = Array.from(groupedData.keys()).sort();

        const datasets = [{
            label: 'Income',
            data: dates.map(date => groupedData.get(date).income || 0),
            borderColor: '#4ECDC4',
            backgroundColor: 'rgba(78, 205, 196, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
        }, {
            label: 'Expenses',
            data: dates.map(date => groupedData.get(date).expenses || 0),
            borderColor: '#FF6B6B',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
        }];

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 0
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatCurrency(value)
                    }
                }
            },
            animation: {
                duration: 250, // Faster animations for iOS
                easing: 'easeOutQuad' // Smoother easing
            },
            // iOS touch optimizations
            events: ['touchstart', 'touchmove', 'click'],
            hover: {
                mode: 'nearest',
                intersect: false,
                animationDuration: 0
            },
            // Optimize rendering
            elements: {
                line: {
                    tension: 0.3, // Smoother lines
                    borderWidth: 2
                },
                point: {
                    hitRadius: 20, // Larger touch targets
                    hoverRadius: 8
                }
            }
        };

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.formatDates(dates, period),
                datasets: datasets
            },
            options: options
        });

        this.charts.set(canvasId, chart);
    }

    groupTransactionsByPeriod(transactions, period) {
        const groupedData = new Map();
        const dateFormat = period === 'year' ? 'YYYY-MM' : 'YYYY-MM-DD';

        transactions.forEach(t => {
            const date = new Date(t.date);
            let key;

            switch (period) {
                case 'week':
                    key = date.toISOString().split('T')[0];
                    break;
                case 'month':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'year':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
            }

            if (!groupedData.has(key)) {
                groupedData.set(key, { income: 0, expenses: 0 });
            }

            const amount = parseFloat(t.amount);
            if (t.type === 'income') {
                groupedData.get(key).income += amount;
            } else {
                groupedData.get(key).expenses += amount;
            }
        });

        return groupedData;
    }

    formatDates(dates, period) {
        return dates.map(date => {
            const [year, month, day] = date.split('-');
            switch (period) {
                case 'week':
                    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                case 'month':
                    return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                case 'year':
                    return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short' });
            }
        });
    }

    async exportChartAsPDF(canvasId, title) {
        try {
            await this.ensureInitialized();

            const chart = this.charts.get(canvasId);
            if (!chart) {
                throw new Error('Chart not found');
            }

            // Initialize jsPDF
            if (!window.jspdf?.jsPDF) {
                throw new Error('PDF library not available. Please ensure jsPDF is properly loaded.');
            }

            const canvas = chart.canvas;
            const imageData = canvas.toDataURL('image/png');

            // Initialize jsPDF
            const pdf = new window.jspdf.jsPDF();
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // Add title
            pdf.setFontSize(16);
            pdf.text(title, 20, 20);

            // Calculate image dimensions to fit page width while maintaining aspect ratio
            const imgWidth = pageWidth - 40;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // Add image
            pdf.addImage(imageData, 'PNG', 20, 30, imgWidth, imgHeight);

            // Add chart data summary
            pdf.setFontSize(12);
            pdf.setTextColor(100);
            let y = 40 + imgHeight;

            if (canvasId === 'category-chart') {
                const data = chart.data.datasets[0].data;
                const labels = chart.data.labels;
                const total = data.reduce((a, b) => a + b, 0);

                pdf.text('Category Breakdown:', 20, y);
                y += 10;

                labels.forEach((label, i) => {
                    const percentage = ((data[i] / total) * 100).toFixed(1);
                    pdf.text(`${label}: ${percentage}%`, 30, y);
                    y += 7;
                });
            } else if (canvasId === 'trend-chart') {
                const datasets = chart.data.datasets;
                const labels = chart.data.labels;
                
                pdf.text('Period Summary:', 20, y);
                y += 10;

                datasets.forEach(dataset => {
                    const total = dataset.data.reduce((a, b) => a + b, 0);
                    const avg = total / dataset.data.length;
                    pdf.text(`Average ${dataset.label}: ${formatCurrency(avg)}`, 30, y);
                    y += 7;
                });
            }

            // Add timestamp
            pdf.setFontSize(10);
            pdf.setTextColor(128);
            const timestamp = new Date().toLocaleString();
            pdf.text(`Generated on ${timestamp}`, 20, pageHeight - 20);

            // Save the PDF
            pdf.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
        } catch (error) {
            console.error('PDF export error:', error);
            throw error;
        }
    }
}

// Create and export chart manager instance
const chartManager = new ChartManager();

// Make chart manager globally available
window.chartManager = chartManager;

export { chartManager };
