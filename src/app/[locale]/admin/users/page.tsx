import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/misc';
import { Pagination } from '@/components/ui/pagination';
import { UserActions } from '@/features/admin/user-actions';
import { resolveLocale } from '@/i18n/server';
import { formatDate } from '@/i18n/format';
import { requirePermission } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { listUsers } from '@/server/services/admin.service';
import { listUsersQuerySchema } from '@/validations/admin';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: `${t.admin.users} · ${t.admin.title}`, robots: { index: false } };
}

const STATUS_TONE = {
  ACTIVE: 'success',
  PENDING_VERIFICATION: 'warning',
  SUSPENDED: 'danger',
  DEACTIVATED: 'neutral',
} as const;

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t } = await resolveLocale(params);
  const auth = await requirePermission(PERMISSIONS.USER_READ_ANY);

  const raw = await searchParams;
  const parsed = listUsersQuerySchema.safeParse({ ...raw, pageSize: '25' });
  const query = parsed.success ? parsed.data : listUsersQuerySchema.parse({ pageSize: '25' });

  const users = await listUsers(query);

  const canManageRoles = auth.permissions.has(PERMISSIONS.USER_ROLE_MANAGE);
  const canSuspend = auth.permissions.has(PERMISSIONS.USER_SUSPEND);
  const isSuperAdmin = auth.roles.includes('SUPER_ADMIN');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.admin.users}</h1>
        <p className="mt-1.5 text-sm text-muted-fg">
          {users.total} {t.common.results}
        </p>
      </header>

      <div className="scrollbar-slim overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th scope="col" className="p-3 text-start font-medium text-muted-fg">
                {t.auth.email}
              </th>
              <th scope="col" className="p-3 text-start font-medium text-muted-fg">
                {t.admin.grantRole}
              </th>
              <th scope="col" className="p-3 text-start font-medium text-muted-fg">
                {t.common.created}
              </th>
              <th scope="col" className="p-3 text-end font-medium text-muted-fg">
                {t.common.edit}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {users.items.map((user) => (
              <tr key={user.id}>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={
                        user.profile
                          ? `${user.profile.firstName} ${user.profile.lastName}`
                          : user.email
                      }
                      src={user.profile?.avatarId ? `/api/files/${user.profile.avatarId}` : null}
                      size={36}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {user.profile
                          ? `${user.profile.firstName} ${user.profile.lastName}`
                          : '—'}
                      </p>
                      <p dir="ltr" className="truncate text-xs text-muted-fg">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={STATUS_TONE[user.status]}>{user.status}</Badge>
                    {user.roles.map((entry) => (
                      <Badge key={entry.role.name} tone="outline">
                        {entry.role.name}
                      </Badge>
                    ))}
                  </div>
                </td>

                <td className="p-3 text-xs text-muted-fg">
                  {formatDate(user.createdAt, locale)}
                  {user.emailVerifiedAt ? null : (
                    <span className="mt-0.5 block text-warning">{t.auth.emailNotVerified}</span>
                  )}
                </td>

                <td className="p-3 text-end">
                  {user.id === auth.user.id ? (
                    <span className="text-xs text-muted-fg">—</span>
                  ) : (
                    <UserActions
                      userId={user.id}
                      status={user.status}
                      roles={user.roles.map((entry) => entry.role.name)}
                      canManageRoles={canManageRoles}
                      canSuspend={canSuspend}
                      isSuperAdmin={isSuperAdmin}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={users.page} totalPages={users.totalPages} />
    </div>
  );
}
