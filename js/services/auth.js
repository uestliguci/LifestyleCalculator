export class AuthService {
    constructor() {
        this.currentUser = null;
        this.allowedUsers = {
            'jonka': {
                password: 'bosi777',
                deviceType: 'iPhone 14 Pro Max'
            },
            'westli': {
                password: 'admin',
                deviceType: 'iPhone 16 Pro Max'
            }
        };
    }

    detectDevice() {
        const userAgent = navigator.userAgent;
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;

        // iPhone 14 Pro Max & iPhone 16 Pro Max: 430x932
        if (screenWidth === 430 && screenHeight === 932) {
            // Since both devices have same dimensions, we'll return iPhone 16 Pro Max
            // The user will be restricted by username/password combination
            return 'iPhone 16 Pro Max';
        }
        return 'unsupported';
    }

    async login(username, password) {
        const device = this.detectDevice();
        
        if (device === 'unsupported') {
            return {
                success: false,
                message: 'This application is only available on iPhone 14 Pro Max and iPhone 16 Pro Max'
            };
        }

        const user = this.allowedUsers[username];
        if (!user) {
            return {
                success: false,
                message: 'Invalid username or password'
            };
        }

        if (user.password !== password) {
            return {
                success: false,
                message: 'Invalid username or password'
            };
        }

        // Check if device matches user's allowed device
        if (username === 'jonka' && device !== 'iPhone 14 Pro Max') {
            return {
                success: false,
                message: 'This account can only be used on iPhone 14 Pro Max'
            };
        }

        if (username === 'westli' && device !== 'iPhone 16 Pro Max') {
            return {
                success: false,
                message: 'This account can only be used on iPhone 16 Pro Max'
            };
        }

        this.currentUser = {
            username,
            device
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
