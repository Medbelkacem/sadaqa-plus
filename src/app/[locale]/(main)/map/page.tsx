import type { Metadata } from 'next';
import dynamicImport from 'next/dynamic';

import { PageHeader } from '@/components/layout/page-header';
import { resolveLocale } from '@/i18n/server';

export const dynamic = 'force-dynamic';

// Leaflet touches `window` at import time, so the map is client-only.
const MapView = dynamicImport(
  () => import('@/features/map/map-view').then((module) => module.MapView),
  {
    loading: () => (
      <div className="h-[32rem] animate-pulse rounded-[var(--radius-card)] bg-surface-sunken" />
    ),
  },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t, locale } = await resolveLocale(params);
  return {
    title: t.map.title,
    description: t.map.subtitle,
    alternates: { canonical: `/${locale}/map` },
  };
}

export default async function MapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { t } = await resolveLocale(params);

  return (
    <>
      <PageHeader title={t.map.title} description={t.map.subtitle} />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <MapView />
      </div>
    </>
  );
}
