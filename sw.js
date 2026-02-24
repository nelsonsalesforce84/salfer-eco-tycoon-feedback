const CACHE_NAME = 'salfer-eco-tycoon-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './salfer-backend.js',
    './firebase-config.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const req = event.request;
    const url = new URL(req.url);

    // Network-first for HTML/navigation
    if (req.mode === 'navigate' || req.destination === 'document') {
        event.respondWith((async () => {
            try {
                const networkResp = await fetch(req);
                const cache = await caches.open(CACHE_NAME);
                cache.put('./index.html', networkResp.clone());
                return networkResp;
            } catch (_) {
                const cached = await caches.match('./index.html');
                return cached || Response.error();
            }
        })());
        return;
    }

    // Stale-while-revalidate for local JS/CSS and allowed CORS assets (fonts/css)
    const isLocal = url.origin === self.location.origin;
    const allowCorsCache = /fonts\.googleapis\.com$/.test(url.hostname) || /fonts\.gstatic\.com$/.test(url.hostname);

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        const fetchAndUpdate = fetch(req).then((resp) => {
            if (resp && resp.ok && (isLocal || allowCorsCache)) {
                cache.put(req, resp.clone());
            }
            return resp;
        }).catch(() => cached);
        return cached || fetchAndUpdate;
    })());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
