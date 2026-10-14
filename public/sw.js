// Unified Service Worker for foodiplace Multi-Portal WebAPK & PWA
const CACHE_NAME = 'foodiplace-pwa-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './customer.html',
  './vendor.html',
  './rider.html',
  './admin.html',
  './subadmin.html',
  './orders.html',
  './manifest.json',
  './manifest.customer.json',
  './manifest.vendor.json',
  './manifest.rider.json',
  './manifest.admin.json',
  './manifest.subadmin.json',
  './manifest.orders.json',
  './icons/icon-main-192.png',
  './icons/icon-main-512.png',
  './icons/icon-rider-192.png',
  './icons/icon-vendor-192.png',
  './icons/icon-admin-192.png',
  './icons/icon-subadmin-192.png',
  './icons/icon-orders-192.png',
  './icons/icon-customer-192.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Pre-cache notice:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && (key.startsWith('foodiplace-') || key.startsWith('foodhub-'))) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests and skip API / WebSocket / database sync
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
        });
      })
  );
});
