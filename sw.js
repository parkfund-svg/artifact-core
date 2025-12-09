const CACHE_NAME = 'artifact-core-v5';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/assets/logo.png',
  '/assets/main.png',
  '/assets/main2.png',
  '/assets/main3.png',
  '/assets/main4.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
