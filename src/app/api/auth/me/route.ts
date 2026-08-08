import { handler, ok } from '@/lib/api/response';
import { getAuthContext } from '@/server/auth/context';
import { unreadCount } from '@/server/services/notification.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Current principal, as the server sees it.
 *
 * The client uses this for rendering only. It is never the basis of an
 * authorization decision — every protected operation re-derives roles and
 * permissions server-side.
 */
export const GET = handler(async () => {
  const auth = await getAuthContext();
  if (!auth) return ok({ authenticated: false as const });

  return ok({
    authenticated: true as const,
    user: auth.user,
    roles: auth.roles,
    permissions: [...auth.permissions],
    organizations: auth.organizations,
    isStaff: auth.isStaff,
    unreadNotifications: await unreadCount(auth.user.id),
  });
});
