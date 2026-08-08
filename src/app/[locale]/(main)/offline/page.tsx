import type { Metadata } from 'next';
import Link from 'next/link';
import { WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { resolveLocale } from '@/i18n/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.pwa.offline, robots: { index: false, follow: false } };
}

/**
 * Offline fallback.
 *
 * Precached by the service worker so it is available with no network at all.
 * It is a static page by design — it must never need a database round-trip.
 */
export default async function OfflinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { t, href } = await resolveLocale(params);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      <div
        className="grid size-14 place-items-center rounded-2xl bg-warning-soft text-warning-soft-fg"
        aria-hidden="true"
      >
        <WifiOff className="size-6" />
      </div>

      <h1 className="text-xl font-semibold text-foreground">{t.pwa.offline}</h1>
      <p className="text-sm leading-relaxed text-muted-fg">{t.pwa.offlineBody}</p>

      <Button asChild variant="secondary">
        <Link href={href('/')}>{t.errors.goHome}</Link>
      </Button>
    </div>
  );
}
