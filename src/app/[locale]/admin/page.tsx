import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ClipboardList,
  Flag,
  HandCoins,
  Megaphone,
  Users,
} from 'lucide-react';

import { ActivityChart } from '@/features/admin/activity-chart';
import { IntegrationStatusPanel } from '@/features/admin/integration-status';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { resolveLocale } from '@/i18n/server';
import { formatCurrency, formatNumber } from '@/i18n/format';
import { integrationStatus } from '@/config/env';
import { emailConfigured } from '@/server/services/email/email.service';
import { malwareScannerConfigured } from '@/server/services/file.service';
import { pushConfigured } from '@/server/services/push.service';
import { paymentsConfigured } from '@/server/payments';
import { getAdminStats, getDailySeries } from '@/server/services/stats.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.admin.overview, robots: { index: false, follow: false } };
}

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t, href } = await resolveLocale(params);

  // Every figure below is a live query. Nothing is cached, estimated or seeded.
  const [stats, series] = await Promise.all([getAdminStats(), getDailySeries(30)]);

  const queues = [
    {
      label: t.admin.requests,
      value: stats.pendingRequests + stats.underReviewRequests,
      path: '/admin/requests',
      icon: ClipboardList,
      urgent: stats.pendingRequests > 0,
    },
    {
      label: t.admin.organizations,
      value: stats.pendingPartnerApplications,
      path: '/admin/organizations/applications',
      icon: Building2,
      urgent: stats.pendingPartnerApplications > 0,
    },
    {
      label: t.admin.reports,
      value: stats.openReports,
      path: '/admin/reports',
      icon: Flag,
      urgent: stats.openReports > 0,
    },
    {
      label: t.admin.campaigns,
      value: stats.pendingCampaigns,
      path: '/admin/campaigns',
      icon: Megaphone,
      urgent: stats.pendingCampaigns > 0,
    },
  ];

  const totals = [
    { label: t.home.statUsers, value: formatNumber(stats.totalUsers, locale), icon: Users },
    {
      label: t.home.statOrganizations,
      value: formatNumber(stats.organizations, locale),
      icon: Building2,
    },
    {
      label: t.home.statRequests,
      value: formatNumber(stats.activeRequests, locale),
      icon: ClipboardList,
    },
    {
      label: t.home.statCampaigns,
      value: formatNumber(stats.activeCampaigns, locale),
      icon: Megaphone,
    },
    {
      label: t.home.statEvents,
      value: formatNumber(stats.upcomingEvents, locale),
      icon: CalendarDays,
    },
    {
      label: t.home.statDonations,
      value: formatCurrency(stats.confirmedDonationTotal, locale),
      icon: HandCoins,
    },
  ];

  const hasActivity = series.some((day) => day.users > 0 || day.requests > 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.admin.overview}</h1>
        <p className="mt-1.5 text-sm text-muted-fg">{t.home.transparencySubtitle}</p>
      </header>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-fg">
          {t.admin.moderationQueue}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {queues.map((queue) => (
            <Link
              key={queue.path}
              href={href(queue.path)}
              className="rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="flex items-center gap-2 text-xs font-medium text-muted-fg">
                <queue.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{queue.label}</span>
              </p>
              <p className="mt-2 flex items-center gap-2">
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {formatNumber(queue.value, locale)}
                </span>
                {queue.urgent ? (
                  <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
                ) : null}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-fg">
          {t.home.transparencyTitle}
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {totals.map((total) => (
            <div
              key={total.label}
              className="rounded-[var(--radius-card)] border border-border bg-surface p-4"
            >
              <dt className="flex items-center gap-2 text-xs font-medium text-muted-fg">
                <total.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{total.label}</span>
              </dt>
              <dd className="mt-2 text-xl font-bold tabular-nums text-foreground">{total.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-fg">
          {t.dashboard.myActivity}
        </h2>
        <Card className="mt-3">
          <CardContent className="pt-6">
            {hasActivity ? (
              <ActivityChart
                data={series}
                labels={{ users: t.home.statUsers, requests: t.admin.requests }}
              />
            ) : (
              // A flat chart of zeros would imply measurement; an empty state
              // says plainly that nothing has happened yet.
              <EmptyState
                compact
                title={t.empty.activityTitle}
                description={t.empty.activityBody}
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-fg">
          {t.admin.integrationsTitle}
        </h2>
        <div className="mt-3">
          <IntegrationStatusPanel
            status={{
              ...integrationStatus(),
              email: emailConfigured(),
              push: pushConfigured(),
              payments: paymentsConfigured(),
              malwareScanner: malwareScannerConfigured(),
            }}
            labels={{
              configured: t.admin.integrationConfigured,
              notConfigured: t.admin.integrationNotConfigured,
            }}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-fg">
          {t.admin.users}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="neutral">
            {t.home.statUsers}: {formatNumber(stats.totalUsers, locale)}
          </Badge>
          <Badge tone="warning">
            {t.auth.emailNotVerified}: {formatNumber(stats.unverifiedUsers, locale)}
          </Badge>
          <Badge tone="danger">
            {t.admin.suspendUser}: {formatNumber(stats.suspendedUsers, locale)}
          </Badge>
          <Badge tone="info">
            {t.donations.intentVsConfirmed}: {formatNumber(stats.donationIntents, locale)}
          </Badge>
        </div>
      </section>
    </div>
  );
}
