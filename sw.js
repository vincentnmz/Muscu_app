/* Novalyz · Service Worker — mode hors-ligne
 * Met en cache la « coquille » de l'app (index.html, manifest, logo) pour
 * qu'elle s'ouvre sans connexion. Les appels de données (Apps Script) ne sont
 * jamais mis en cache : ils passent au réseau, et l'app gère le hors-ligne
 * (file d'attente des séances) de son côté.
 */
const CACHE = 'novalyz-shell-v90';
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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== 'novalyz-notif').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ===== Notifications push (Étape A : messages) =============================
 * Le backend (Supabase) envoie un payload JSON { title, body, tag, target }.
 * On affiche la notification ; au clic, on ouvre l'app sur la bonne cible. */
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
    // On conserve la cible (ex. 'conversation') pour le clic (notificationclick).
    data: { url: data.url || './', target: data.target || '' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const target = d.target || '';   // ex. 'conversation'
  e.waitUntil((async () => {
    // Source unique : on dépose TOUJOURS la cible dans un cache. L'app la lit au
    // démarrage ET quand elle repasse au premier plan (fiable sur iOS, où le clic
    // relance l'app au start_url en ignorant les query params).
    if (target) {
      try {
        const c = await caches.open('novalyz-notif');
        await c.put('pending-target', new Response(target, { headers: { 'content-type': 'text/plain' } }));
      } catch (_) {}
    }
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of list) {
      if ('focus' in client) {
        try { await client.focus(); } catch (_) {}
        try { client.postMessage({ type: 'novalyz-notif-check' }); } catch (_) {}
        return;
      }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(target ? ('./?notif=' + encodeURIComponent(target)) : './');
    }
  })());
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
