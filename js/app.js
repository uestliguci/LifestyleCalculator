import { indexedDBStorage } from './services/indexed-db-storage.js';
import { ui } from './ui.js';
import { chartManager } from './charts.js';
import { CATEGORIES, CURRENCIES } from './config.js';
import { authService } from './services/auth.js';

/**
 * Main application class
 */
class App {
    constructor() {
        this.appContainer = document.getElementById('app-container');
        this.loginOverlay = document.getElementById('login-overlay');
        this.loginForm = document.getElementById('login-form');
        this.loginError = document.getElementById('login-error');
        this.usernameDisplay = document.getElementById('username-display');
        this.initialize();
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            // Initialize IndexedDB
            await indexedDBStorage.init();
            console.log('IndexedDB initialized successfully');
            
            // Setup authentication
            this.setupAuth();

            // Check if user is already logged in
            const user = authService.getCurrentUser();
            if (user) {
                this.onLoginSuccess(user);
            }

            // Setup event handlers for global functions
            const { viewTransaction } = await import('./services/transaction-viewer.js');
            window.viewTransaction = viewTransaction;

            // Add keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Check for data import
            this.handleDataImport();
        } catch (error) {
            console.error('Initialization error:', error);
            ui.showAlert('Failed to initialize app. Please refresh the page.', 'error');
        }
    }

    /**
     * Setup authentication handlers
     */
    setupAuth() {
        // Handle login form submission
        this.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const result = await authService.login(username, password);
                if (result.success) {
                    this.onLoginSuccess(result.user);
                } else {
                    this.loginError.textContent = result.message;
                }
            } catch (error) {
                console.error('Login error:', error);
                this.loginError.textContent = 'An error occurred during login';
            }
        });

        // Handle logout
        window.logout = () => {
            authService.logout();
            this.onLogout();
        };
    }

    /**
     * Handle successful login
     */
    onLoginSuccess(user) {
        // Hide login overlay
        this.loginOverlay.style.display = 'none';
        // Show app container
        this.appContainer.style.display = 'block';
        // Display username
        this.usernameDisplay.textContent = user.username;
        // Initialize UI components
        this.initializeUI();
    }

    /**
     * Handle logout
     */
    onLogout() {
        // Show login overlay
        this.loginOverlay.style.display = 'flex';
        // Hide app container
        this.appContainer.style.display = 'none';
        // Clear login form
        this.loginForm.reset();
        this.loginError.textContent = '';
    }

    /**
     * Format amount with currency symbol
     */
    formatAmount(amount, currencyCode) {
        const currency = CURRENCIES[currencyCode];
        if (!currency) return `${amount}`;
        
        const formattedAmount = parseFloat(amount).toFixed(2);
        return currency.position === 'before' 
            ? `${currency.symbol}${formattedAmount}`
            : `${formattedAmount}${currency.symbol}`;
    }

    /**
     * Initialize UI components
     */
    initializeUI() {
        // Setup currency change handlers
        const currencySelects = document.querySelectorAll('select[id$="-currency"]');
        currencySelects.forEach(select => {
            select.addEventListener('change', () => {
                if (select.id === 'currency') {
                    // Update amount label with selected currency
                    const amountLabel = document.querySelector('label[for="amount"]');
                    const currency = CURRENCIES[select.value];
                    amountLabel.textContent = `Amount (${currency.symbol})`;
                }
                ui.refreshCurrentSection();
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
     * @param {string} type - Transaction type
     * @param {string} selected - Selected category
     * @returns {string} HTML options
     */
    getCategoryOptions(type, selected = '') {
        const categories = CATEGORIES[type] || [];
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
        
        if (typeSelect && categorySelect) {
            const type = typeSelect.value.toLowerCase();
            categorySelect.innerHTML = this.getCategoryOptions(type);
        }
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        // Add transaction type change handler
        const typeSelect = document.getElementById('transaction-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => this.updateTransactionForm());
        }

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

            // Escape to close modals or cancel edits
            if (e.key === 'Escape') {
                const editForm = document.querySelector('.edit-form');
                if (editForm) {
                    const cancelBtn = editForm.querySelector('.btn-secondary');
                    if (cancelBtn) cancelBtn.click();
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
     * @param {File} file - File to import
     */
    async readAndImportFile(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const result = await indexedDBStorage.importData(e.target.result);
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
