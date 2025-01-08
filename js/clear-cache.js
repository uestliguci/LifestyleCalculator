// Clear service worker and cache
async function clearServiceWorkerAndCache() {
    try {
        // Unregister service worker
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            await registration.unregister();
            console.log('ServiceWorker unregistered');
        }

        // Clear caches
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('Cache cleared');

        // Redirect to index.html
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Failed to clear:', error);
    }
}

clearServiceWorkerAndCache();
