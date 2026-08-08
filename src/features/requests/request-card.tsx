import Link from 'next/link';
import { MapPin, ShieldCheck } from 'lucide-react';

import { UrgencyBadge } from '@/components/status/badges';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Dictionary } from '@/i18n';
import type { AppLocale } from '@/i18n/config';
import { formatRelative, localizedName } from '@/i18n/format';
import type { RequestCardData } from '@/server/services/request.service';

export function RequestCard({
  request,
  locale,
  t,
}: {
  request: RequestCardData;
  locale: AppLocale;
  t: Dictionary;
}) {
  const href = `/${locale}/requests/${request.slug}`;
  const place = request.commune
    ? `${localizedName(request.commune, locale)}, ${localizedName(request.wilaya, locale)}`
    : localizedName(request.wilaya, locale);

  return (
    <Card interactive className="flex h-full flex-col">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone="neutral"
            style={
              request.category.color
                ? {
                    // Tint the chip with the category colour without dropping
                    // below the contrast floor: colour carries the border and
                    // text, never the whole background.
                    borderColor: `${request.category.color}44`,
                    color: request.category.color,
                    backgroundColor: `${request.category.color}12`,
                  }
                : undefined
            }
          >
            {localizedName(request.category, locale)}
          </Badge>
          <UrgencyBadge level={request.urgency} t={t} />
        </div>

        <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-foreground">
          <Link
            href={href}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {request.title}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-fg">
          {request.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-fg">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {place}
          </span>
          {request.publishedAt ? (
            <time dateTime={request.publishedAt.toISOString()}>
              {formatRelative(request.publishedAt, locale)}
            </time>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          {t.verification.verifiedBy}
        </span>
        {request.organization ? (
          <span className="truncate text-xs text-muted-fg">
            {request.organization.publicName}
          </span>
        ) : (
          <span className="font-mono text-[11px] text-muted-fg">{request.reference}</span>
        )}
      </div>
    </Card>
  );
}
