// Service worker minimal — sert uniquement à rendre l'app installable (PWA).
// Volontairement SANS cache agressif : on ne veut pas servir du contenu périmé
// (produits, prix, réglages) aux clients. Tout passe par le réseau en priorité.
const CACHE_NAME = 'tof-shell-v1';
const SHELL = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // On ne touche jamais aux appels API (Supabase) : réseau direct.
  if (url.origin !== self.location.origin) return;

  // Strategy : réseau d'abord, repli sur le cache (offline) pour les navigations.
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(request).then((m) => m || caches.match('/'))),
  );
});
