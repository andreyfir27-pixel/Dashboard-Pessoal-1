// Placeholder simple service worker for offline caching
const CACHE_NAME = 'tudo-em-ordem-cache-v1';
const urlsToCache = ['index.html','styles.css','app.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(resp => resp || fetch(event.request)));
});
