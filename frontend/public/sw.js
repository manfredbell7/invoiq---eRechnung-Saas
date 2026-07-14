// invoiq Service Worker — Network-First (verhindert veraltete Bundles)
// Cache-Name mit Datum: ändert sich bei jedem Deploy, alte Caches werden gelöscht.
const CACHE = 'invoiq-' + '2026-06-13-v2';

// Install: sofort aktivieren, nicht auf alten SW warten
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Activate: ALLE alten Caches löschen + sofort Kontrolle übernehmen
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API-Calls + Nicht-GET: immer Netzwerk, nie cachen
  if (url.pathname.startsWith('/v1/') || url.hostname.startsWith('api.invoiq.') || e.request.method !== 'GET') {
    return; // Browser-Standard
  }

  // Nur eigene Origin behandeln
  if (url.origin !== self.location.origin) return;

  // HTML-Navigationen + JS/CSS: NETWORK-FIRST
  // So kommt nach jedem Deploy sofort das neue Bundle an.
  const isAsset = e.request.mode === 'navigate'
    || url.pathname.endsWith('.html')
    || url.pathname.endsWith('.js')
    || url.pathname.endsWith('.css')
    || url.pathname === '/';

  if (isAsset) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          // frische Version cachen (nur als Offline-Reserve)
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // Sonstige statische Dateien (Bilder, Fonts, Icons): Cache-First (ändern sich selten)
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached || fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});
