import type { Metadata } from 'next';
import { CheckCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { ApplicationDecision } from '@/features/admin/application-decision';
import { resolveLocale } from '@/i18n/server';
import { formatRelative, localizedName } from '@/i18n/format';
import { requirePermission } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { listPartnerApplications } from '@/server/services/organization.service';
import { paginationSchema } from '@/validations/common';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: `${t.admin.organizations} · ${t.admin.title}`, robots: { index: false } };
}

export default async function AdminApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t } = await resolveLocale(params);
  await requirePermission(PERMISSIONS.PARTNER_APPLICATION_REVIEW);

  const raw = await searchParams;
  const { page, pageSize } = paginationSchema.parse({ page: raw.page, pageSize: '20' });
  const status =
    typeof raw.status === 'string' &&
    ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(raw.status)
      ? (raw.status as 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED')
      : undefined;

  const applications = await listPartnerApplications(status, page, pageSize);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.organizations.applyTitle}
        </h1>
        <p className="mt-1.5 text-sm text-muted-fg">
          {applications.total} {t.common.results}
        </p>
      </header>

      {applications.items.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title={t.empty.notificationsTitle}
          description={t.empty.organizationsBody}
        />
      ) : (
        <>
          <ul className="space-y-4">
            {applications.items.map((application) => (
              <li
                key={application.id}
                className="rounded-[var(--radius-card)] border border-border bg-surface p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          application.status === 'PENDING'
                            ? 'warning'
                            : application.status === 'UNDER_REVIEW'
                              ? 'info'
                              : application.status === 'APPROVED'
                                ? 'success'
                                : 'danger'
                        }
                      >
                        {t.organizations.applicationStatus[application.status]}
                      </Badge>
                      <span className="text-xs text-muted-fg">
                        {localizedName(application.wilaya, locale)}
                      </span>
                      {application._count.documents > 0 ? (
                        <span className="text-xs text-muted-fg">
                          {application._count.documents} {t.organizations.documents.toLowerCase()}
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-2 text-base font-semibold text-foreground">
                      {application.organizationName}
                    </h2>

                    <p className="mt-1 text-sm text-muted-fg">
                      {application.contactPersonName} ·{' '}
                      <span dir="ltr">{application.contactEmail}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-fg">
                      {application.areaOfWork} · {formatRelative(application.createdAt, locale)}
                    </p>
                  </div>

                  {application.status === 'PENDING' || application.status === 'UNDER_REVIEW' ? (
                    <ApplicationDecision applicationId={application.id} status={application.status} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <Pagination page={applications.page} totalPages={applications.totalPages} />
        </>
      )}
    </div>
  );
}
