import { BadgeCheck, CalendarDays, HandCoins, HeartHandshake, Megaphone, Users } from 'lucide-react';

import type { Dictionary } from '@/i18n';
import type { AppLocale } from '@/i18n/config';
import { formatCurrency, formatNumber } from '@/i18n/format';
import type { PublicStats } from '@/server/services/stats.service';

/**
 * Public counters.
 *
 * Values come straight from `getPublicStats()`, which is a set of live
 * COUNT/SUM queries. A zero is rendered as a plain "0" — never hidden, never
 * replaced by a placeholder, never padded with a fictional baseline.
 */
export function StatGrid({
  stats,
  locale,
  t,
}: {
  stats: PublicStats;
  locale: AppLocale;
  t: Dictionary;
}) {
  const items = [
    { icon: Users, label: t.home.statUsers, value: formatNumber(stats.users, locale) },
    {
      icon: BadgeCheck,
      label: t.home.statOrganizations,
      value: formatNumber(stats.organizations, locale),
    },
    {
      icon: HeartHandshake,
      label: t.home.statRequests,
      value: formatNumber(stats.activeRequests, locale),
    },
    {
      icon: Megaphone,
      label: t.home.statCampaigns,
      value: formatNumber(stats.activeCampaigns, locale),
    },
    {
      icon: CalendarDays,
      label: t.home.statEvents,
      value: formatNumber(stats.upcomingEvents, locale),
    },
    {
      icon: HandCoins,
      label: t.home.statDonations,
      value: formatCurrency(stats.confirmedDonationTotal, locale),
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[var(--radius-card)] border border-border bg-surface p-4"
        >
          <dt className="flex items-center gap-2 text-xs font-medium text-muted-fg">
            <item.icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </dt>
          <dd className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
