const CACHE = 'scotsponsor-shell-v26';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/scotland-landscape.svg', '/career-support.jpg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    // Cache the built entry points too, so the first visit can work offline.
    const response = await fetch('/');
    if (!response.ok) throw new Error('Unable to cache the app shell');
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
    await cache.addAll([...SHELL, ...assets]);
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('scotsponsor-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put('/', response.clone()));
      return response;
    }).catch(() => caches.match('/')));
    return;
  }
  event.respondWith(fetch(request).then(response => {
    if (response.ok && (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname))) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
    }
    return response;
  }).catch(() => caches.match(request)));
});
