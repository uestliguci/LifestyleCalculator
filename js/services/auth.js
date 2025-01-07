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
        const pixelRatio = window.devicePixelRatio;

        // Check if it's an iPhone
        const isiPhone = /iPhone/.test(userAgent);
        
        if (!isiPhone) {
            return 'unsupported';
        }

        // iPhone 14/16 Pro Max detection
        // Both have 430x932 screen and 3x pixel ratio
        if (screenWidth === 430 && screenHeight === 932 && pixelRatio === 3) {
            // Since Safari on iOS 17 (iPhone 16) doesn't expose detailed model info,
            // we'll use iOS version to differentiate
            const iOSMatch = userAgent.match(/OS (\d+)_/);
            const iOSVersion = iOSMatch ? parseInt(iOSMatch[1]) : 0;
            
            if (iOSVersion >= 17) {
                return 'iPhone 16 Pro Max';
            } else {
                return 'iPhone 14 Pro Max';
            }
        }
        return 'unsupported';
    }

    async login(username, password) {
        const device = this.detectDevice();
        
        if (device === 'unsupported') {
            // Check if it's an iPhone at all
            const isiPhone = /iPhone/.test(navigator.userAgent);
            const message = isiPhone 
                ? 'This application is only available on iPhone 14 Pro Max and iPhone 16 Pro Max'
                : 'This application is only available on mobile devices (iPhone 14 Pro Max and iPhone 16 Pro Max)';
            return {
                success: false,
                message: message
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
