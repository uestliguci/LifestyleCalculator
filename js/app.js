import { ui } from './ui.js';
import { chartManager } from './charts.js';
import { CATEGORIES, CURRENCIES } from './config.js';
import { localStorageManager } from './services/local-storage-manager.js';

/**
 * Main application class
 */
class App {
    constructor() {
        this.initialize();
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            // Setup event handlers for global functions
            const { viewTransaction } = await import('./services/transaction-viewer.js');
            window.viewTransaction = viewTransaction;

            // Initialize UI components
            this.initializeUI();

            // Add keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Check for data import
            this.handleDataImport();

            console.log('App initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            ui.showAlert('Failed to initialize app. Please refresh the page.', 'error');
        }
    }

    /**
     * Format amount with currency symbol
     */
    formatAmount(amount, currencyCode) {
        const currency = CURRENCIES[currencyCode];
        if (!currency) return `${amount}`;
        
        const formattedAmount = parseFloat(amount).toFixed(2);
        return currency.position === 'before' 
            ? `${currency.symbol} ${formattedAmount}`
            : `${formattedAmount} ${currency.symbol}`;
    }

    /**
     * Initialize UI components
     */
    initializeUI() {
        // Initialize transaction form and modal
        const addButton = document.querySelector('.add-button');
        const modal = document.getElementById('add-transaction-modal');
        const typeSelect = document.getElementById('transaction-type');
        const closeBtn = modal?.querySelector('.btn-close');

        if (addButton && modal && typeSelect) {
            // Initialize form when modal is shown
            addButton.addEventListener('click', () => {
                modal.style.display = 'flex';
                // Reset form and initialize categories
                const form = document.getElementById('transaction-form');
                form?.reset();
                this.updateTransactionForm();
                // Focus amount field
                setTimeout(() => {
                    document.getElementById('amount')?.focus();
                }, 300);
            });

            // Update categories when type changes
            typeSelect.addEventListener('change', () => {
                this.updateTransactionForm();
                // Re-focus amount field
                document.getElementById('amount')?.focus();
            });

            // Close modal on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });

            // Close modal on close button click
            closeBtn?.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Initialize bottom menu tabs with iOS-style transitions
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', () => {
                const menuId = tab.dataset.menu;
                if (menuId) {
                    // Update active tab with animation
                    document.querySelectorAll('.tab-item').forEach(t => {
                        if (t === tab) {
                            if (!t.classList.contains('active')) {
                                t.classList.add('active');
                                t.querySelector('svg')?.animate([
                                    { transform: 'scale(1)' },
                                    { transform: 'scale(1.2)' },
                                    { transform: 'scale(1.1)' }
                                ], {
                                    duration: 300,
                                    easing: 'ease-out'
                                });
                            }
                        } else {
                            t.classList.remove('active');
                        }
                    });
                    
                    // Show selected section with transition
                    document.querySelectorAll('.menu-section').forEach(section => {
                        if (section.id === menuId) {
                            section.style.display = 'block';
                            requestAnimationFrame(() => {
                                section.classList.add('active');
                            });
                        } else {
                            section.classList.remove('active');
                            section.addEventListener('transitionend', () => {
                                if (!section.classList.contains('active')) {
                                    section.style.display = 'none';
                                }
                            }, { once: true });
                        }
                    });

                    // Update section title with animation
                    const sectionTitle = document.querySelector('.section-title');
                    if (sectionTitle) {
                        sectionTitle.style.opacity = '0';
                        sectionTitle.style.transform = 'translateY(10px)';
                        setTimeout(() => {
                            sectionTitle.textContent = menuId.charAt(0).toUpperCase() + menuId.slice(1);
                            sectionTitle.style.opacity = '1';
                            sectionTitle.style.transform = 'translateY(0)';
                        }, 150);
                    }

                    // Refresh section content
                    ui.refreshCurrentSection();
                }
            });
        });

        // Set current month in analytics
        const analyticsMonth = document.getElementById('analytics-month');
        if (analyticsMonth) {
            analyticsMonth.value = new Date().toISOString().slice(0, 7);
        }

        // Set current year in balance sheet
        const balanceSheetYear = document.getElementById('balance-sheet-year');
        if (balanceSheetYear) {
            const currentYear = new Date().getFullYear();
            for (let year = currentYear - 5; year <= currentYear; year++) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                if (year === currentYear) option.selected = true;
                balanceSheetYear.appendChild(option);
            }
        }

        // Initial data refresh
        ui.refreshCurrentSection();
    }

    /**
     * Get HTML options for category select
     */
    getCategoryOptions(type, selected = '') {
        const categories = CATEGORIES[type.toLowerCase()] || [];
        return categories.map(category => 
            `<option value="${category}" ${category === selected ? 'selected' : ''}>${category}</option>`
        ).join('');
    }

    /**
     * Update transaction form based on type
     */
    updateTransactionForm() {
        const typeSelect = document.getElementById('transaction-type');
        const categorySelect = document.getElementById('category');
        const amountLabel = document.querySelector('label[for="amount"]');
        
        if (typeSelect && categorySelect) {
            const type = typeSelect.value.toLowerCase();
            categorySelect.innerHTML = this.getCategoryOptions(type);
        }

        // Update amount label with Albanian Lek
        if (amountLabel) {
            amountLabel.textContent = 'Amount (Lek - Albanian Lek)';
        }
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S to save current transaction
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                const form = document.getElementById('transaction-form');
                if (form) form.dispatchEvent(new Event('submit'));
            }

            // Ctrl/Cmd + E to export data
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                ui.exportData();
            }

            // Escape to close modals
            if (e.key === 'Escape') {
                const modal = document.querySelector('.modal[style*="flex"]');
                if (modal) {
                    modal.style.display = 'none';
                }
            }
        });
    }

    /**
     * Handle data import from file
     */
    handleDataImport() {
        // Handle drag and drop
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.json')) {
                await this.readAndImportFile(file);
            }
        });

        // Handle paste
        document.addEventListener('paste', async (e) => {
            const items = e.clipboardData.items;
            for (let item of items) {
                if (item.kind === 'file' && item.type === 'application/json') {
                    const file = item.getAsFile();
                    await this.readAndImportFile(file);
                    break;
                }
            }
        });
    }

    /**
     * Read and import data from file
     */
    async readAndImportFile(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const result = await localStorageManager.importData(e.target.result);
            if (result.success) {
                ui.showAlert('Data imported successfully', 'success');
                ui.refreshCurrentSection();
            } else {
                ui.showAlert(result.message, 'error');
            }
        };
        reader.readAsText(file);
    }
}

// Initialize application
const app = new App();
window.app = app;
