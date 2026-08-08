import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, ClipboardCheck, MapPin, Users } from 'lucide-react';

import { ShareRow } from '@/components/share/share-row';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EventRegistration } from '@/features/events/event-registration';
import { ReportDialog } from '@/features/moderation/report-dialog';
import { SaveButton } from '@/features/saved/save-button';
import { resolveLocale } from '@/i18n/server';
import { formatDateTime, formatNumber, localizedName } from '@/i18n/format';
import { getAuthContext } from '@/server/auth/context';
import { getPublicEventBySlug } from '@/server/services/event.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const event = await getPublicEventBySlug(slug);
  if (!event) return { title: 'Introuvable' };

  return {
    title: event.title,
    description: event.summary,
    alternates: { canonical: `/${locale}/events/${slug}` },
    openGraph: {
      type: 'article',
      title: event.title,
      description: event.summary,
      url: `/${locale}/events/${slug}`,
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, t, href } = await resolveLocale(params as Promise<{ locale: string }>);
  const { slug } = await params;

  const auth = await getAuthContext();
  const event = await getPublicEventBySlug(slug, auth?.user.id);
  if (!event) notFound();

  const registered = event._count.registrations;
  const seatsLeft = event.capacity ? Math.max(0, event.capacity - registered) : null;
  const place = event.commune
    ? `${localizedName(event.commune, locale)}, ${localizedName(event.wilaya, locale)}`
    : localizedName(event.wilaya, locale);

  // Structured data helps the event surface in search results correctly.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.summary,
    startDate: event.startsAt.toISOString(),
    endDate: event.endsAt.toISOString(),
    eventStatus:
      event.status === 'CANCELLED'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: event.venue ?? place,
      address: { '@type': 'PostalAddress', addressLocality: place, addressCountry: 'DZ' },
    },
    ...(event.organization
      ? { organizer: { '@type': 'Organization', name: event.organization.publicName } }
      : {}),
  };

  return (
    <article className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted-fg">
        <Link href={href('/events')} className="underline-offset-4 hover:underline">
          {t.events.title}
        </Link>
      </nav>

      {event.coverId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/files/${event.coverId}`}
          alt=""
          className="mb-7 aspect-21/9 w-full rounded-[var(--radius-card)] border border-border object-cover"
        />
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{localizedName(event.category, locale)}</Badge>
            <Badge tone={event.status === 'PUBLISHED' ? 'success' : 'neutral'}>
              {t.events.status[event.status]}
            </Badge>
          </div>

          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-foreground">
            {event.title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-fg">{event.summary}</p>

          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2.5 rounded-[var(--radius-field)] border border-border p-3">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                  {t.events.when}
                </dt>
                <dd className="mt-0.5 text-sm text-foreground">
                  <time dateTime={event.startsAt.toISOString()}>
                    {formatDateTime(event.startsAt, locale)}
                  </time>
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-[var(--radius-field)] border border-border p-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                  {t.events.where}
                </dt>
                <dd className="mt-0.5 text-sm text-foreground">
                  {event.venue ? `${event.venue} · ${place}` : place}
                </dd>
              </div>
            </div>
          </dl>

          <div className="mt-7 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
            {event.description}
          </div>

          {event.requirements ? (
            <Card className="mt-6">
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                  {t.volunteer.missions}
                </p>
                <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">
                  {event.requirements}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <section className="mt-10">
            <h2 className="text-lg font-semibold text-foreground">{t.events.report}</h2>
            {event.reportContent ? (
              <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-fg">
                {event.reportContent}
              </div>
            ) : (
              <p className="mt-3 rounded-[var(--radius-card)] border border-dashed border-border bg-surface-muted/60 px-4 py-6 text-center text-sm text-muted-fg">
                {t.events.noReport}
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <EventRegistration
            eventId={event.id}
            registration={event.myRegistration}
            full={seatsLeft === 0}
            authenticated={Boolean(auth)}
            past={event.hasStarted}
          />

          <Card>
            <CardContent className="space-y-2 pt-5 text-sm">
              <p className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-muted-fg">
                  <Users className="size-4" aria-hidden="true" />
                  {t.events.participants}
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatNumber(registered, locale)}
                </span>
              </p>
              {event.capacity ? (
                <p className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-muted-fg">
                    <ClipboardCheck className="size-4" aria-hidden="true" />
                    {t.events.capacity}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatNumber(event.capacity, locale)}
                  </span>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-5">
              <SaveButton targetType="EVENT" targetId={event.id} authenticated={Boolean(auth)} />
              <ShareRow title={event.title} path={`/${locale}/events/${event.slug}`} />
              <ReportDialog targetType="EVENT" targetId={event.id} authenticated={Boolean(auth)} />
            </CardContent>
          </Card>

          {event.organization ? (
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                  {t.campaigns.organizer}
                </p>
                <Link
                  href={href(`/organizations/${event.organization.slug}`)}
                  className="mt-1.5 block text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {event.organization.publicName}
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
