'use client';

import * as React from 'react';
import { WifiOff } from 'lucide-react';

import { useI18n } from '@/i18n/context';

/**
 * Connectivity indicator.
 *
 * `navigator.onLine` only proves the device has a network interface, not that
 * the server is reachable — so this is a hint, not a guarantee, and it only
 * ever *adds* information. Nothing is blocked on the basis of it.
 */
export function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-center text-xs font-medium text-warning-soft-fg"
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{t.pwa.offline}</span>
    </div>
  );
}
