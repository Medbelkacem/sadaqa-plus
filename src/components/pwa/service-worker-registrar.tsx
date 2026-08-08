'use client';

import * as React from 'react';

/**
 * Registers the service worker.
 *
 * Deliberately skipped in development: a stale worker caching dev bundles is
 * a well-known source of "why isn't my change showing" confusion, and offline
 * behaviour is verified against a production build anyway.
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // Activate a waiting worker immediately on the next navigation so
          // users are not stuck on a stale build after a deploy.
          registration.addEventListener('updatefound', () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                installing.postMessage('SKIP_WAITING');
              }
            });
          });
        })
        .catch((error) => {
          console.error('[pwa] service worker registration failed', error);
        });
    };

    // Registering after load keeps the worker off the critical path.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
