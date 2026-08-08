/**
 * Sadaqa+ service worker.
 *
 * Caching policy is deliberately conservative, because this application
 * handles data about vulnerable people:
 *
 *   - Only GET requests for the app shell, static assets and *public* pages
 *     are cached.
 *   - Anything under /api, /admin, /dashboard, /messages, /notifications or
 *     /profile is NEVER cached, and any response carrying
 *     `Cache-Control: private` or `no-store` is skipped too.
 *   - Authenticated HTML is served network-first and never written to the
 *     cache, so a shared device cannot replay another person's screens.
 *
 * Bump CACHE_VERSION to invalidate every cache at once.
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `sadaqa-shell-${CACHE_VERSION}`;
const PAGE_CACHE = `sadaqa-pages-${CACHE_VERSION}`;
const ASSET_CACHE = `sadaqa-assets-${CACHE_VERSION}`;

const OFFLINE_URLS = ['/fr/offline', '/ar/offline', '/en/offline'];

const PRECACHE = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  ...OFFLINE_URLS,
];

/** Path prefixes whose responses must never touch a cache. */
const PRIVATE_PREFIXES = [
  '/api/',
  '/admin',
  '/dashboard',
  '/messages',
  '/notifications',
  '/profile',
  '/auth/',
];

function isPrivatePath(pathname) {
  // Strip the locale segment before matching: /fr/dashboard is still private.
  const withoutLocale = pathname.replace(/^\/(fr|ar|en)(?=\/|$)/, '');
  return PRIVATE_PREFIXES.some(
    (prefix) => withoutLocale.startsWith(prefix) || pathname.startsWith(prefix),
  );
}

function isCacheableResponse(response) {
  if (!response || !response.ok || response.type === 'opaque') return false;
  const cacheControl = response.headers.get('Cache-Control') || '';
  return !/no-store|private/i.test(cacheControl);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // A single missing precache entry must not abort installation.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.endsWith(CACHE_VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isPrivatePath(url.pathname)) return; // straight to the network, uncached

  // Immutable build output: cache-first is safe because the hash changes.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (isCacheableResponse(response)) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Public HTML: network-first so content is fresh, with the cached copy as a
  // fallback and a dedicated offline page as the last resort.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheableResponse(response)) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;

          const locale = (url.pathname.match(/^\/(fr|ar|en)(?=\/|$)/) || [, 'fr'])[1];
          const offline = await caches.match(`/${locale}/offline`);
          return (
            offline ||
            new Response('Hors connexion', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        }),
    );
    return;
  }

  // Everything else (fonts, images): stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (isCacheableResponse(response)) {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    }),
  );
});

// --- Push -------------------------------------------------------------------

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Sadaqa+', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Sadaqa+', {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      tag: payload.tag || 'sadaqa',
      data: { url: payload.url || '/' },
      dir: 'auto',
      // Never keep a notification silent-but-visible: the Push API requires a
      // user-visible notification for every push we accept.
      requireInteraction: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab rather than piling up new ones.
      for (const client of clientList) {
        if (client.url.includes(target) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
