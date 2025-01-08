const CACHE_NAME = 'financial-app-v2';
const STATIC_ASSETS = [
    'index.html',
    'offline.html',
    'manifest.json',
    'styles/main.css',
    'styles/components.css',
    'styles/auth.css',
    'styles/menu-styles.css',
    'styles/balance.css',
    'styles/analytics.css',
    'js/app.js',
    'js/ui.js',
    'js/utils.js',
    'js/charts.js',
    'js/config.js',
    'js/services/storage-manager.js',
    'js/services/auth.js',
    'js/services/balance-manager.js',
    'js/services/pdf-export.js',
    'icons/icon-72x72.png',
    'icons/icon-96x96.png',
    'icons/icon-128x128.png',
    'icons/icon-144x144.png',
    'icons/icon-152x152.png',
    'icons/icon-192x192.png',
    'icons/icon-384x384.png',
    'icons/icon-512x512.png',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'js/lib/jspdf.umd.min.js',
    'js/lib/jspdf.plugin.autotable.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching static assets...');
                // Cache known assets
                return cache.addAll(STATIC_ASSETS.map(url => {
                    // Only convert CDN URLs to absolute, keep local paths relative
                    return url.startsWith('http') ? url : url;
                }));
            })
            .catch(error => {
                console.error('Cache installation failed:', error);
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Skip PDF exports and other non-GET requests
    if (event.request.method !== 'GET' || 
        event.request.url.endsWith('.pdf')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                // Determine if we're running locally
                const isLocal = location.hostname === 'localhost' || 
                              location.hostname === '127.0.0.1' ||
                              location.protocol === 'file:';

                // Adjust request URL based on environment
                let requestUrl = event.request.url;
                if (!isLocal && requestUrl.includes('/LifestyleCalculator/')) {
                    // We're on GitHub Pages, use the full path
                    requestUrl = event.request.url;
                } else if (requestUrl.includes('/LifestyleCalculator/')) {
                    // We're local but URL contains the GitHub Pages path, strip it
                    requestUrl = requestUrl.replace('/LifestyleCalculator/', '/');
                }

                return fetch(new Request(requestUrl)).then(response => {
                    // Check if we received a valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone the response as it can only be consumed once
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
            .catch(() => {
                // If both cache and network fail, show offline page
                if (event.request.mode === 'navigate') {
                    return caches.match('offline.html');
                }
                return new Response('Network error', { status: 408, statusText: 'Network error' });
            })
    );
});

// Handle PDF export requests
self.addEventListener('message', (event) => {
    if (event.data.type === 'EXPORT_PDF') {
        // Skip caching for PDF exports
        event.waitUntil(
            fetch(event.data.url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/pdf'
                }
            }).then(response => {
                return response.blob();
            }).then(blob => {
                // Send the PDF blob back to the client
                event.ports[0].postMessage({
                    type: 'PDF_READY',
                    blob: blob
                });
            }).catch(error => {
                event.ports[0].postMessage({
                    type: 'PDF_ERROR',
                    error: error.message
                });
            })
        );
    }
});
