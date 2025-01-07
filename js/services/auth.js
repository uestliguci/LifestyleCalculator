export class AuthService {
    constructor() {
        this.currentUser = null;
        this.baseUrl = 'http://localhost:3001';
    }

    async login(username, password) {
        try {
            const response = await fetch(`${this.baseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();
            
            if (!result.success) {
                return {
                    success: false,
                    message: result.message || 'Invalid username or password'
                };
            }

            this.currentUser = result.user;
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));

            return {
                success: true,
                user: this.currentUser
            };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: 'An error occurred during login'
            };
        }
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
