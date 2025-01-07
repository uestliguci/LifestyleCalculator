export class AuthService {
    constructor() {
        this.currentUser = null;
        this.allowedUsers = {
            'jonka': {
                password: 'bosi777'
            },
            'westli': {
                password: 'admin'
            }
        };
    }

    async login(username, password) {
        const user = this.allowedUsers[username];
        if (!user || user.password !== password) {
            return {
                success: false,
                message: 'Invalid username or password'
            };
        }

        this.currentUser = {
            username
        };

        // Store in localStorage for persistence
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
