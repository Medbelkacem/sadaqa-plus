import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { ReportDecision } from '@/features/admin/report-decision';
import { resolveLocale } from '@/i18n/server';
import { formatRelative } from '@/i18n/format';
import { requirePermission } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { listReports } from '@/server/services/moderation.service';
import { paginationSchema } from '@/validations/common';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: `${t.admin.reports} · ${t.admin.title}`, robots: { index: false } };
}

const TARGET_PATH: Record<string, string> = {
  REQUEST: '/requests',
  CAMPAIGN: '/campaigns',
  EVENT: '/events',
  ORGANIZATION: '/organizations',
};

export default async function AdminReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t, href } = await resolveLocale(params);
  await requirePermission(PERMISSIONS.REPORT_MODERATE);

  const raw = await searchParams;
  const { page, pageSize } = paginationSchema.parse({ page: raw.page, pageSize: '20' });
  const status =
    typeof raw.status === 'string' &&
    ['OPEN', 'UNDER_REVIEW', 'ACTION_TAKEN', 'DISMISSED'].includes(raw.status)
      ? (raw.status as 'OPEN' | 'UNDER_REVIEW' | 'ACTION_TAKEN' | 'DISMISSED')
      : undefined;

  const reports = await listReports(status, page, pageSize);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.admin.reports}</h1>
        <p className="mt-1.5 text-sm text-muted-fg">
          {reports.total} {t.common.results}
        </p>
      </header>

      {reports.items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t.empty.notificationsTitle}
          description={t.empty.activityBody}
        />
      ) : (
        <>
          <ul className="space-y-4">
            {reports.items.map((report) => (
              <li
                key={report.id}
                className="rounded-[var(--radius-card)] border border-border bg-surface p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          report.status === 'OPEN'
                            ? 'warning'
                            : report.status === 'UNDER_REVIEW'
                              ? 'info'
                              : report.status === 'ACTION_TAKEN'
                                ? 'success'
                                : 'neutral'
                        }
                      >
                        {t.reports.status[report.status]}
                      </Badge>
                      <Badge tone="outline">{t.reports.reasons[report.reason]}</Badge>
                      <span className="text-xs text-muted-fg">{report.targetType}</span>
                    </div>

                    {report.description ? (
                      <p className="mt-2 whitespace-pre-line text-sm text-foreground">
                        {report.description}
                      </p>
                    ) : null}

                    <p className="mt-2 text-xs text-muted-fg">
                      {report.reporter?.profile
                        ? `${report.reporter.profile.firstName} ${report.reporter.profile.lastName}`
                        : t.common.anonymous}{' '}
                      · {formatRelative(report.createdAt, locale)}
                    </p>

                    {TARGET_PATH[report.targetType] ? (
                      <Link
                        href={href(`${TARGET_PATH[report.targetType]}`)}
                        className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline"
                      >
                        {t.common.seeMore}
                      </Link>
                    ) : null}

                    {report.resolution ? (
                      <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted-fg">
                        {report.resolution}
                      </p>
                    ) : null}
                  </div>

                  {report.status === 'OPEN' || report.status === 'UNDER_REVIEW' ? (
                    <ReportDecision reportId={report.id} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <Pagination page={reports.page} totalPages={reports.totalPages} />
        </>
      )}
    </div>
  );
}
