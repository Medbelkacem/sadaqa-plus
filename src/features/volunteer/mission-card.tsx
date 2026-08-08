import Link from 'next/link';
import { CalendarDays, MapPin, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Dictionary } from '@/i18n';
import type { AppLocale } from '@/i18n/config';
import { formatDateTime, formatNumber, localizedName } from '@/i18n/format';
import type { MissionCardData } from '@/server/services/volunteer.service';

export function MissionCard({
  mission,
  locale,
  t,
}: {
  mission: MissionCardData;
  locale: AppLocale;
  t: Dictionary;
}) {
  const href = `/${locale}/volunteer/missions/${mission.slug}`;
  const remaining = Math.max(0, mission.volunteersNeeded - mission.volunteersAccepted);
  const place = mission.commune
    ? `${localizedName(mission.commune, locale)}, ${localizedName(mission.wilaya, locale)}`
    : localizedName(mission.wilaya, locale);

  return (
    <Card interactive className="relative flex h-full flex-col p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{localizedName(mission.category, locale)}</Badge>
        <Badge tone={remaining === 0 ? 'neutral' : 'success'}>
          {remaining === 0
            ? t.volunteer.missionStatus.FULL
            : `${formatNumber(remaining, locale)} ${t.volunteer.missionsNeeded}`}
        </Badge>
      </div>

      <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-foreground">
        <Link
          href={href}
          className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {mission.title}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-fg">
        {mission.description}
      </p>

      <dl className="mt-4 space-y-1.5 text-xs text-muted-fg">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{t.events.when}</dt>
          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
          <dd>
            <time dateTime={mission.startsAt.toISOString()}>
              {formatDateTime(mission.startsAt, locale)}
            </time>
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{t.events.where}</dt>
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <dd className="truncate">{mission.venue ? `${mission.venue} · ${place}` : place}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{t.volunteer.missions}</dt>
          <Users className="size-3.5 shrink-0" aria-hidden="true" />
          <dd className="truncate">{mission.organization.publicName}</dd>
        </div>
      </dl>
    </Card>
  );
}
