// Field Inspector – Service Worker
const CACHE = 'field-inspector-v1';
const OFFLINE_FILES = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only handle same-origin or CDN requests
  const url = new URL(e.request.url);

  // For navigation requests, serve cached index.html when offline
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // For CDN scripts (Tesseract.js), cache on first load
  if (url.hostname.includes('jsdelivr') || url.hostname.includes('tessdata')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Weather API – network only (no cache; degrade gracefully when offline)
  if (url.hostname.includes('open-meteo') || url.hostname.includes('archive-api')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Everything else: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
