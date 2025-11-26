const CACHE_NAME = 'nexstar-planner-v20';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Use { cache: 'reload' } to bypass HTTP cache for these requests during install
        const requests = urlsToCache.map(url => new Request(url, { cache: 'reload' }));
        return cache.addAll(requests);
      })
      .then(() => self.skipWaiting()) // Force the waiting service worker to become the active service worker.
  );
});

self.addEventListener('fetch', event => {
  // Use a Network falling back to Cache strategy for navigation requests.
  // This ensures the user always gets the latest version of the app shell.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If the fetch is successful, cache the response for offline use and return it.
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // If the fetch fails (e.g., offline), return the cached page.
          return caches.match('/index.html') || caches.match(event.request);
        })
    );
    return; // Important: end execution for navigate requests.
  }

  // Use a Cache falling back to Network strategy for all other assets (JS, CSS, images, etc.).
  // This is efficient and provides offline functionality for assets.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response.
        if (response) {
          return response;
        }

        // Not in cache - fetch from network, then cache for future use.
        return fetch(event.request).then(
          networkResponse => {
            // Check for a valid response before caching. Opaque responses (from no-cors requests)
            // shouldn't be cached as their status can't be checked.
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        );
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open pages.
  );
});