// Mwendo Salama PWA Service Worker - Offline Resilient Cache Shell
const CACHE_NAME = 'mwendo-salama-__BUILD_ID__';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// Install event: Pre-cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell assets into', CACHE_NAME);
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Cache addAll warning:', err);
      });
    })
    // Unconditional skipWaiting() removed to prevent silent takeover during active sessions.
    // The worker remains waiting until client explicitly sends 'SKIP_WAITING' message.
  );
});

// Activate event: Cleanup stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting stale deployment cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Message event: Explicit SKIP_WAITING trigger from client UI prompt (PWA-001 & PWA-002)
self.addEventListener('message', (event) => {
  if (
    event.data === 'SKIP_WAITING' ||
    (typeof event.data === 'object' && event.data !== null && event.data.type === 'SKIP_WAITING')
  ) {
    console.log('[SW] User accepted update - calling self.skipWaiting()');
    self.skipWaiting();
  }
});

// Fetch event: Network-first with offline SPA fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Exclude non-http or external API domain calls if needed
  if (!url.protocol.startsWith('http')) return;

  // SPA navigation handling (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Serve cached index.html when offline
          return caches.match('/index.html').then((cachedIndex) => {
            return cachedIndex || caches.match('/');
          });
        })
    );
    return;
  }

  // Static assets (scripts, styles, images, fonts)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
