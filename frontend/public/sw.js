// invoiq Service Worker — PWA Offline-Support
const CACHE = 'invoiq-v1';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

// Install: App-Shell cachen
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

// Activate: alte Caches löschen
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch-Strategie
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API-Calls: niemals cachen (immer frische Daten)
  if (url.pathname.startsWith('/v1/') || url.hostname.includes('api.invoiq.io') || e.request.method !== 'GET') {
    return; // Browser-Standard (Netzwerk)
  }

  // Statische Assets: Cache-First mit Netzwerk-Fallback
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        // Erfolgreiche GET-Antworten für nächstes Mal cachen
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html')); // Offline-Fallback
    })
  );
});
