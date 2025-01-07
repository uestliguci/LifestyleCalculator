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

        console.log('Device Detection Debug:');
        console.log('User Agent:', userAgent);
        console.log('Screen:', screenWidth, 'x', screenHeight);
        console.log('Pixel Ratio:', pixelRatio);

        // Check for Pro Max dimensions
        if (screenWidth === 430 && screenHeight === 932 && pixelRatio === 3) {
            // Both devices are running iOS 18
            const iOSMatch = userAgent.match(/iPhone OS (\d+)_(\d+)/);
            if (iOSMatch) {
                const majorVersion = parseInt(iOSMatch[1]);
                const minorVersion = parseInt(iOSMatch[2]);
                
                console.log('iOS Version:', majorVersion, minorVersion);
                
                if (majorVersion === 18) {
                    // iPhone 16 Pro Max is running 18.2.1
                    if (minorVersion >= 2) {
                        console.log('Detected iPhone 16 Pro Max (iOS 18.2.1)');
                        return 'iPhone 16 Pro Max';
                    }
                    // iPhone 14 Pro Max is running 18.1.1
                    if (minorVersion === 1) {
                        console.log('Detected iPhone 14 Pro Max (iOS 18.1.1)');
                        return 'iPhone 14 Pro Max';
                    }
                }
            }
        } else {
            console.log('Screen dimensions or pixel ratio not matching');
        }
        
        console.log('Device not supported');
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
