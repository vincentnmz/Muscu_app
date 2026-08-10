/* Novalyz · Service Worker — mode hors-ligne
 * Met en cache la « coquille » de l'app (index.html, manifest, logo) pour
 * qu'elle s'ouvre sans connexion. Les appels de données (Apps Script) ne sont
 * jamais mis en cache : ils passent au réseau, et l'app gère le hors-ligne
 * (file d'attente des séances) de son côté.
 */
const CACHE = 'novalyz-shell-v17';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo novalyz.png',
  './js/app.js',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/layout.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Données live (Google Apps Script) : toujours le réseau, jamais le cache.
  if (url.hostname.indexOf('script.google') !== -1 ||
      url.hostname.indexOf('googleusercontent') !== -1) {
    return; // le navigateur gère (réseau) ; l'app a sa file d'attente hors-ligne
  }

  // Coquille de l'app (même origine, GET) : cache d'abord, réseau en secours.
  if (req.method === 'GET' && url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => caches.match('./index.html'));
      })
    );
  }
});
