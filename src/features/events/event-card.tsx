import Link from 'next/link';
import { CalendarDays, MapPin, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Dictionary } from '@/i18n';
import type { AppLocale } from '@/i18n/config';
import { formatDateTime, formatNumber, localizedName } from '@/i18n/format';
import type { EventCardData } from '@/server/services/event.service';

export function EventCard({
  event,
  locale,
  t,
}: {
  event: EventCardData;
  locale: AppLocale;
  t: Dictionary;
}) {
  const href = `/${locale}/events/${event.slug}`;
  const registered = event._count.registrations;
  const seatsLeft = event.capacity ? Math.max(0, event.capacity - registered) : null;
  const place = event.commune
    ? `${localizedName(event.commune, locale)}, ${localizedName(event.wilaya, locale)}`
    : localizedName(event.wilaya, locale);

  return (
    <Card interactive className="relative flex h-full flex-col">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary">{localizedName(event.category, locale)}</Badge>
          {seatsLeft === 0 ? <Badge tone="danger">{t.events.full}</Badge> : null}
          {event.status !== 'PUBLISHED' ? (
            <Badge tone="neutral">{t.events.status[event.status]}</Badge>
          ) : null}
        </div>

        <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-foreground">
          <Link
            href={href}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {event.title}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-fg">
          {event.summary}
        </p>

        <dl className="mt-4 space-y-1.5 text-xs text-muted-fg">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">{t.events.when}</dt>
            <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
            <dd>
              <time dateTime={event.startsAt.toISOString()}>
                {formatDateTime(event.startsAt, locale)}
              </time>
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">{t.events.where}</dt>
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <dd className="truncate">{event.venue ? `${event.venue} · ${place}` : place}</dd>
          </div>
        </dl>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-fg">
        <span className="truncate">{event.organization?.publicName ?? 'Sadaqa+'}</span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <Users className="size-3.5" aria-hidden="true" />
          {seatsLeft !== null
            ? `${formatNumber(seatsLeft, locale)} ${t.events.seatsLeft}`
            : `${formatNumber(registered, locale)} ${t.events.participants}`}
        </span>
      </div>
    </Card>
  );
}
