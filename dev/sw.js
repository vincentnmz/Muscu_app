/* Novalyz · Service Worker — mode hors-ligne
 * Met en cache la « coquille » de l'app (index.html, manifest, logo) pour
 * qu'elle s'ouvre sans connexion. Les appels de données (Apps Script) ne sont
 * jamais mis en cache : ils passent au réseau, et l'app gère le hors-ligne
 * (file d'attente des séances) de son côté.
 */
const CACHE = 'novalyz-shell-v63';
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

/* ===== Notifications push (Étape A : messages) =============================
 * Le backend (Supabase) envoie un payload JSON { title, body, url, tag }.
 * On affiche la notification ; au clic, on ouvre/refocalise l'app. */
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) {
    try { data = { body: e.data ? e.data.text() : '' }; } catch (__) { data = {}; }
  }
  const title = data.title || 'Novalyz';
  const options = {
    body: data.body || '',
    icon: './logo novalyz.png',
    badge: './logo novalyz.png',
    tag: data.tag || 'novalyz-msg',
    renotify: true,
    data: { url: data.url || './' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.focus(); if ('navigate' in c && target !== './') { try { c.navigate(target); } catch (_) {} } return; }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
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
