import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { resolveLocale } from '@/i18n/server';
import { formatDateTime } from '@/i18n/format';
import { requirePermission } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { listAuditLog } from '@/server/services/admin.service';
import { listAuditQuerySchema } from '@/validations/admin';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: `${t.admin.auditLogs} · ${t.admin.title}`, robots: { index: false } };
}

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t } = await resolveLocale(params);
  await requirePermission(PERMISSIONS.AUDIT_READ);

  const raw = await searchParams;
  const parsed = listAuditQuerySchema.safeParse({ ...raw, pageSize: '50' });
  const query = parsed.success ? parsed.data : listAuditQuerySchema.parse({ pageSize: '50' });

  const log = await listAuditLog(query);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.admin.auditLogs}</h1>
        <p className="mt-1.5 text-sm text-muted-fg">
          {log.total} {t.common.results}
        </p>
      </header>

      {log.items.length === 0 ? (
        <EmptyState title={t.empty.activityTitle} description={t.empty.activityBody} />
      ) : (
        <>
          <div className="scrollbar-slim overflow-x-auto rounded-[var(--radius-card)] border border-border">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="bg-surface-muted">
                <tr>
                  <th scope="col" className="p-3 text-start font-medium text-muted-fg">
                    {t.common.created}
                  </th>
                  <th scope="col" className="p-3 text-start font-medium text-muted-fg">
                    {t.admin.users}
                  </th>
                  <th scope="col" className="p-3 text-start font-medium text-muted-fg">
                    Action
                  </th>
                  <th scope="col" className="p-3 text-start font-medium text-muted-fg">
                    Cible
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {log.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap p-3 text-xs text-muted-fg">
                      {formatDateTime(entry.createdAt, locale)}
                    </td>
                    <td className="p-3">
                      {entry.actor ? (
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">
                            {entry.actor.profile
                              ? `${entry.actor.profile.firstName} ${entry.actor.profile.lastName}`
                              : '—'}
                          </p>
                          <p dir="ltr" className="truncate text-xs text-muted-fg">
                            {entry.actor.email}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-fg">système</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge tone="outline">{entry.action}</Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-fg">
                      {entry.targetType ? (
                        <>
                          {entry.targetType}
                          {entry.targetId ? (
                            <span className="ms-1 font-mono opacity-70">
                              {entry.targetId.slice(0, 8)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={log.page} totalPages={log.totalPages} />
        </>
      )}
    </div>
  );
}
