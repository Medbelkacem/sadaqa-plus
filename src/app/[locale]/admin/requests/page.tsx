import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCheck } from 'lucide-react';

import { UrgencyBadge, RequestStatusBadge } from '@/components/status/badges';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { resolveLocale } from '@/i18n/server';
import { formatRelative, localizedName } from '@/i18n/format';
import { requirePermission } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { listModerationQueue } from '@/server/services/request.service';
import { paginationSchema } from '@/validations/common';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: `${t.admin.requests} · ${t.admin.title}`, robots: { index: false } };
}

export default async function AdminRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t, href } = await resolveLocale(params);

  // Re-checked here even though the layout already gated the area: the layout
  // only proves "staff", this proves "may moderate requests".
  await requirePermission(PERMISSIONS.REQUEST_MODERATE);

  const raw = await searchParams;
  const { page, pageSize } = paginationSchema.parse({
    page: raw.page,
    pageSize: raw.pageSize ?? '20',
  });

  const queue = await listModerationQueue(page, pageSize);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.admin.moderationQueue}
        </h1>
        <p className="mt-1.5 text-sm text-muted-fg">
          {queue.total} {t.common.results}
        </p>
      </header>

      {queue.items.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title={t.empty.notificationsTitle}
          description={t.empty.genericBody}
        />
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
            {queue.items.map((request) => (
              <li key={request.id}>
                <Link
                  href={href(`/admin/requests/${request.id}`)}
                  className="flex flex-wrap items-start gap-3 p-4 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <RequestStatusBadge status={request.status} t={t} />
                      <UrgencyBadge level={request.urgency} t={t} />
                      <span className="text-xs text-muted-fg">
                        {localizedName(request.category, locale)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-medium text-foreground">{request.title}</p>

                    <p className="mt-1 text-xs text-muted-fg">
                      {request.reference} · {localizedName(request.wilaya, locale)} ·{' '}
                      {formatRelative(request.createdAt, locale)}
                      {request._count.attachments > 0
                        ? ` · ${request._count.attachments} ${t.requests.steps.attachments.toLowerCase()}`
                        : ''}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination page={queue.page} totalPages={queue.totalPages} />
        </>
      )}
    </div>
  );
}
