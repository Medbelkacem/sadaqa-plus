import Link from 'next/link';
import { MapPin, ShieldCheck } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/misc';
import type { Dictionary } from '@/i18n';
import type { AppLocale } from '@/i18n/config';
import { localizedName } from '@/i18n/format';
import type { OrganizationCardData } from '@/server/services/organization.service';

export function OrganizationCard({
  organization,
  locale,
  t,
}: {
  organization: OrganizationCardData;
  locale: AppLocale;
  t: Dictionary;
}) {
  const href = `/${locale}/organizations/${organization.slug}`;

  return (
    <Card interactive className="relative flex h-full flex-col p-5">
      <div className="flex items-start gap-3">
        <Avatar
          name={organization.publicName}
          src={organization.logoId ? `/api/files/${organization.logoId}` : null}
          size={44}
          className="rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-snug text-foreground">
            <Link
              href={href}
              className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {organization.publicName}
            </Link>
          </h3>
          {organization.wilaya ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-fg">
              <MapPin className="size-3" aria-hidden="true" />
              {localizedName(organization.wilaya, locale)}
            </p>
          ) : null}
        </div>
      </div>

      <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-fg">
        {organization.description}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-success">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          {t.verification.verified}
        </span>
        <span className="text-muted-fg">
          {organization._count.campaigns} {t.nav.campaigns.toLowerCase()} ·{' '}
          {organization._count.events} {t.nav.events.toLowerCase()}
        </span>
      </div>
    </Card>
  );
}
