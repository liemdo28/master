/**
 * TaskFlow Service Worker
 *
 * Strategy:
 * - /admin/* and /api/* → network-only (never cache dashboard or API responses)
 * - Static assets (JS/CSS/fonts/images) → stale-while-revalidate
 *   (serve cached copy immediately, then fetch fresh copy in background)
 * - Everything else (HTML navigation) → network-first with offline fallback
 *
 * CACHE_VERSION must be bumped on every deploy that changes JS/CSS.
 * Incrementing it evicts the old cache so users always get fresh assets.
 */

const CACHE_VERSION = 'taskflow-v4';

const STATIC_ASSETS = [
    '/assets/js/safe-date.js',
    '/assets/js/error-boundary.js',
    '/assets/js/calendar-transform.js',
    '/assets/js/layout.js',
    '/assets/js/app.js',
    '/assets/js/global-search.js',
    '/assets/js/detail-drawer.js',
    '/assets/js/task-drawer.js',
    '/assets/js/board.js',
    '/assets/js/timeline.js',
    '/assets/js/saved-views.js',
    '/assets/js/bulk-actions.js',
    '/assets/css/tokens.css',
    '/assets/css/base.css',
    '/assets/css/style.css',
    '/assets/css/layout.css',
    '/assets/css/ux-extras.css',
    '/assets/css/ux-unified.css',
    '/assets/css/task-drawer.css',
    '/assets/css/detail-drawer.css',
    '/assets/css/global-search.css',
    '/assets/css/ceo-readability.css',
    '/assets/css/components/buttons.css',
    '/assets/css/components/forms.css',
    '/assets/css/components/cards.css',
    '/assets/css/components/modal.css',
    '/assets/css/components/dropdown.css',
    '/assets/css/components/badge.css',
    '/assets/css/components/error-boundary.css',
    '/assets/css/pages/auth.css',
    '/assets/css/pages/dashboard.css',
    '/assets/css/pages/tasks.css',
    '/assets/css/pages/bills.css',
    '/assets/css/pages/calendar.css',
    '/assets/css/pages/inbox.css',
    '/manifest.json',
];

// On install: pre-cache all static assets and activate immediately
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// On activate: delete all old cache versions
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(k => k !== CACHE_VERSION)
                    .map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle same-origin requests
    if (url.origin !== self.location.origin) return;

    const path = url.pathname;

    // Admin, API, and auth routes → always network, never cache
    if (
        path.startsWith('/admin') ||
        path.startsWith('/api/') ||
        path.startsWith('/login') ||
        path.startsWith('/logout') ||
        path === '/sw.js'
    ) {
        event.respondWith(fetch(request));
        return;
    }

    // Static assets → stale-while-revalidate
    if (
        path.startsWith('/assets/') ||
        path === '/manifest.json' ||
        path.startsWith('/assets/icons/')
    ) {
        event.respondWith(
            caches.open(CACHE_VERSION).then(cache =>
                cache.match(request).then(cached => {
                    const networkFetch = fetch(request).then(response => {
                        if (response.ok) cache.put(request, response.clone());
                        return response;
                    });
                    return cached || networkFetch;
                })
            )
        );
        return;
    }

    // Navigation (HTML pages) → network-first, fall back to cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match(request).then(r => r || caches.match('/'))
            )
        );
        return;
    }
});
