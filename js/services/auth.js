import { storageManager } from './storage-manager.js';

export class AuthService {
    constructor() {
        this.currentUser = null;
        this.initializeFromStorage();
    }

    initializeFromStorage() {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                this.currentUser = JSON.parse(storedUser);
                storageManager.setCurrentUser(this.currentUser);
            } catch (error) {
                console.error('Failed to restore user:', error);
                this.logout();
            }
        }
    }

    async login(username, password) {
        // Validate credentials
        if (!username || !password) {
            return {
                success: false,
                message: 'Username and password are required'
            };
        }

        // Check for specific users
        const validUsers = {
            'jonka': {
                password: 'bosi777',
                name: 'Jonka'
            },
            'westli': {
                password: 'admin2025',
                name: 'Westli'
            }
        };

        const userInfo = validUsers[username];
        if (!userInfo || userInfo.password !== password) {
            return {
                success: false,
                message: 'Invalid username or password'
            };
        }

        try {
            // Create user session
            this.currentUser = {
                username,
                name: userInfo.name,
                role: 'user',
                lastLogin: new Date().toISOString()
            };

            // Store user session
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            
            // Initialize user's storage
            storageManager.setCurrentUser(this.currentUser);

            // Try to restore backup if exists
            const backupKey = `${username}_backup`;
            const backup = localStorage.getItem(backupKey);
            if (backup) {
                try {
                    await storageManager.importData(backup);
                } catch (backupError) {
                    console.error('Failed to restore backup:', backupError);
                }
            }

            return {
                success: true,
                user: this.currentUser
            };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: 'Failed to initialize user data'
            };
        }
    }

    async logout() {
        try {
            // Export data before logout for backup
            const data = await storageManager.exportData();
            const backupKey = `${this.currentUser.username}_backup`;
            localStorage.setItem(backupKey, data);

            // Clear current session
            this.currentUser = null;
            localStorage.removeItem('currentUser');
            storageManager.setCurrentUser(null);

            window.location.reload();
        } catch (error) {
            console.error('Logout error:', error);
            // Force logout even if backup fails
            this.currentUser = null;
            localStorage.removeItem('currentUser');
            storageManager.setCurrentUser(null);
            window.location.reload();
        }
    }

    getCurrentUser() {
        if (this.currentUser) {
            return this.currentUser;
        }

        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            this.currentUser = JSON.parse(storedUser);
            return this.currentUser;
        }

        return null;
    }

    isAuthenticated() {
        return this.getCurrentUser() !== null;
    }
}

export const authService = new AuthService();
