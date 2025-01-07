const CACHE_NAME = 'finance-app-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './styles/main.css',
    './styles/components.css',
    './js/app.js',
    './js/ui.js',
    './js/charts.js',
    './js/config.js',
    './js/utils.js',
    './js/services/indexed-db-storage.js',
    './js/services/transaction-viewer.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    './offline.html'
];

// Install service worker and cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch strategy: Network first, falling back to cache
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests except for CDN
    if (!event.request.url.startsWith(self.location.origin) && 
        !event.request.url.startsWith('https://cdn.jsdelivr.net')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache successful responses
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Return cached response or offline page
                return caches.match(event.request)
                    .then((response) => {
                        if (response) {
                            return response;
                        }
                        // If the request is for a page, return the offline page
                        if (event.request.mode === 'navigate') {
                            return caches.match('/offline.html');
                        }
                        return new Response('', {
                            status: 408,
                            statusText: 'Request timed out'
                        });
                    });
            })
    );
});

// Handle push notifications
self.addEventListener('push', (event) => {
    const options = {
        body: event.data.text(),
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'view',
                title: 'View App'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Financial Management System', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});
