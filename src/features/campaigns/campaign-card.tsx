import Link from 'next/link';
import { MapPin, Target } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { Dictionary } from '@/i18n';
import type { AppLocale } from '@/i18n/config';
import { formatCurrency, formatNumber, localizedName } from '@/i18n/format';
import type { CampaignCardData } from '@/server/services/campaign.service';

export function CampaignCard({
  campaign,
  locale,
  t,
}: {
  campaign: CampaignCardData;
  locale: AppLocale;
  t: Dictionary;
}) {
  const href = `/${locale}/campaigns/${campaign.slug}`;
  const { progress } = campaign;

  const isMonetary = campaign.goalType === 'MONETARY';
  const raised = isMonetary
    ? formatCurrency(progress.raisedAmount, locale, campaign.currency)
    : `${formatNumber(progress.raisedQuantity, locale)} ${campaign.unitLabel ?? ''}`.trim();
  const target = isMonetary
    ? campaign.targetAmount
      ? formatCurrency(Number(campaign.targetAmount), locale, campaign.currency)
      : null
    : campaign.targetQuantity
      ? `${formatNumber(campaign.targetQuantity, locale)} ${campaign.unitLabel ?? ''}`.trim()
      : null;

  return (
    <Card interactive className="relative flex h-full flex-col">
      {/* Covers are served through the authorized /api/files route, which
          enforces per-file permissions. next/image cannot run that check, so a
          plain <img> is the correct element here. */}
      {campaign.coverId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/files/${campaign.coverId}`}
          alt=""
          loading="lazy"
          className="h-40 w-full rounded-t-[var(--radius-card)] object-cover"
        />
      ) : null}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{localizedName(campaign.category, locale)}</Badge>
          {campaign.status !== 'ACTIVE' ? (
            <Badge tone="neutral">{t.campaigns.status[campaign.status]}</Badge>
          ) : null}
        </div>

        <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-foreground">
          <Link
            href={href}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {campaign.title}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-fg">
          {campaign.summary}
        </p>

        <div className="mt-4 space-y-2">
          {/* `percent` is null when the campaign carries no numeric target;
              the bar disappears rather than showing an invented ratio. */}
          <Progress value={progress.percent} label={t.campaigns.progress} />
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">{raised}</span>
            {target ? (
              <span className="text-muted-fg">
                {t.campaigns.target}: {target}
                {progress.percent !== null ? ` · ${progress.percent}%` : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-fg">
                <Target className="size-3.5" aria-hidden="true" />
                {t.campaigns.noTarget}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-fg">
        <span className="truncate">{campaign.organization?.publicName ?? 'Sadaqa+'}</span>
        {campaign.wilaya ? (
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <MapPin className="size-3.5" aria-hidden="true" />
            {localizedName(campaign.wilaya, locale)}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
