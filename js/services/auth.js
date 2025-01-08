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
            } catch (error) {
                console.error('Failed to restore user:', error);
                this.logout();
            }
        }
    }

    async login(username, password) {
        // For GitHub Pages demo, accept any non-empty credentials
        if (!username || !password) {
            return {
                success: false,
                message: 'Username and password are required'
            };
        }

        // Create demo user
        this.currentUser = {
            username,
            name: username,
            role: 'user',
            lastLogin: new Date().toISOString()
        };

        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));

        return {
            success: true,
            user: this.currentUser
        };
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        window.location.reload();
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
