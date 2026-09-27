/* LodgeCore online PWA worker. It caches static assets only, never app data. */
const CACHE_NAME = 'lodgecore-pwa-static-v1';
const EXCLUDED_PREFIXES = ['/frontdesk', '/pos', '/desktop', '/admin/pos'];

function isExcludedPath(pathname) {
  return EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isCacheableStaticRequest(request, url) {
  if (request.method !== 'GET' || url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/image')) return false;
  if (isExcludedPath(url.pathname)) return false;
  return url.pathname.startsWith('/_next/static/') ||
    ['/favicon.ico', '/lodgecore-logo.png', '/manifest.webmanifest'].includes(url.pathname);
}

// Navigation requests are deliberately never handled by this worker. This
// means the PWA cannot supply a cached shell for Front Desk, POS, desktop, or
// any authenticated online page. The server remains the source of truth.

self.addEventListener('install', () => {});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('lodgecore-pwa-static-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key)),
  )));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!isCacheableStaticRequest(event.request, url)) return;
  event.respondWith(caches.match(event.request).then((cached) => {
    if (cached) return cached;
    return fetch(event.request).then((response) => {
      if (!response.ok) return response;
      const copy = response.clone();
      void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    });
  }));
});
