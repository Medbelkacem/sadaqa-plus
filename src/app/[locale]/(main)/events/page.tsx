import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CalendarDays } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { EventCard } from '@/features/events/event-card';
import { resolveLocale } from '@/i18n/server';
import { listPublicEvents } from '@/server/services/event.service';
import { listEventsQuerySchema } from '@/validations/event';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t, locale } = await resolveLocale(params);
  return {
    title: t.events.title,
    description: t.events.subtitle,
    alternates: { canonical: `/${locale}/events` },
  };
}

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t } = await resolveLocale(params);
  const raw = await searchParams;
  const parsed = listEventsQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : listEventsQuerySchema.parse({});

  const result = await listPublicEvents({ ...query, upcomingOnly: query.upcomingOnly });

  return (
    <>
      <PageHeader title={t.events.title} description={t.events.subtitle} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {result.items.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={t.empty.eventsTitle}
            description={t.empty.eventsBody}
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-fg">
              {result.total} {t.common.results}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((event) => (
                <EventCard key={event.id} event={event} locale={locale} t={t} />
              ))}
            </div>
            <Suspense fallback={null}>
              <Pagination page={result.page} totalPages={result.totalPages} className="mt-8" />
            </Suspense>
          </>
        )}
      </div>
    </>
  );
}
