import 'server-only';

import { headers } from 'next/headers';

import { serverEnv } from '@/config/env';
import { errors } from '@/lib/api/errors';
import type { OrgMemberRole } from '@prisma/client';
import type { PermissionKey } from '@/server/permissions/definitions';

import { getAuthContext, hasOrgRole, type AuthContext } from './context';

/**
 * Authorization guards.
 *
 * Every mutation and every non-public read goes through one of these. They
 * throw `AppError`s that the API envelope converts into the documented error
 * codes, so a missing check surfaces as a 401/403 rather than a data leak.
 */

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuthContext();
  if (!auth) throw errors.unauthenticated();
  return auth;
}

/**
 * Requires a verified email address. Used for anything that becomes publicly
 * visible or contacts another person.
 */
export async function requireVerifiedAuth(): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!auth.user.emailVerified) {
    throw errors.forbidden('Please confirm your email address before continuing.');
  }
  return auth;
}

export async function requirePermission(permission: PermissionKey): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!auth.permissions.has(permission)) throw errors.forbidden();
  return auth;
}

export async function requireAnyPermission(
  ...permissions: PermissionKey[]
): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!permissions.some((p) => auth.permissions.has(p))) throw errors.forbidden();
  return auth;
}

export async function requireStaff(): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!auth.isStaff) throw errors.forbidden();
  return auth;
}

/**
 * Requires membership of an organization at or above `minimum`.
 * Staff with the given override permission bypass membership (for moderation).
 */
export async function requireOrgMember(
  organizationId: string,
  minimum: OrgMemberRole = 'MEMBER',
  staffOverride?: PermissionKey,
): Promise<AuthContext> {
  const auth = await requireAuth();
  if (hasOrgRole(auth, organizationId, minimum)) return auth;
  if (staffOverride && auth.permissions.has(staffOverride)) return auth;
  // Deliberately a 404-shaped denial elsewhere; here the org id is already
  // known to the caller, so a 403 leaks nothing extra.
  throw errors.forbidden();
}

/**
 * Cross-site request forgery defence for state-changing requests.
 *
 * Session cookies are SameSite=Lax, which already blocks cross-site POSTs from
 * forms and fetch. This adds a second, explicit origin check so a future
 * cookie policy change cannot silently open a hole.
 */
export async function requireSameOrigin() {
  const store = await headers();
  const origin = store.get('origin');

  // Same-origin fetches from older clients may omit Origin entirely; those are
  // covered by SameSite. A *present but foreign* Origin is always rejected.
  if (!origin) return;

  const allowed = new Set<string>([new URL(serverEnv().APP_URL).origin]);
  const host = store.get('host');
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }

  if (!allowed.has(origin)) {
    throw errors.forbidden('Cross-origin request rejected.');
  }
}

/** Guards /api/cron/* endpoints with a shared secret. */
export async function requireCronSecret() {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) throw errors.notConfigured('Scheduled jobs (CRON_SECRET)');

  const store = await headers();
  const provided =
    store.get('authorization')?.replace(/^Bearer\s+/i, '') ?? store.get('x-cron-secret');

  if (!provided || provided !== secret) throw errors.unauthenticated();
}
