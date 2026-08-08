import 'server-only';

import { cache } from 'react';

import type { Locale, OrgMemberRole, RoleName, UserStatus } from '@prisma/client';

import { prisma } from '@/server/db/prisma';
import {
  ROLE_PERMISSIONS,
  STAFF_ROLES,
  type PermissionKey,
  type RoleNameValue,
} from '@/server/permissions/definitions';

import { readSession } from './session';

export type OrganizationMembership = {
  organizationId: string;
  slug: string;
  publicName: string;
  role: OrgMemberRole;
  verificationStatus: string;
};

export type AuthContext = {
  sessionId: string;
  user: {
    id: string;
    email: string;
    status: UserStatus;
    locale: Locale;
    emailVerified: boolean;
    firstName: string;
    lastName: string;
    displayName: string;
    avatarId: string | null;
    wilayaId: number | null;
    communeId: number | null;
    onboarded: boolean;
  };
  roles: RoleName[];
  permissions: Set<PermissionKey>;
  organizations: OrganizationMembership[];
  isStaff: boolean;
};

/**
 * Loads the authenticated principal for the current request.
 *
 * Roles and permissions are always derived from the database, never from a
 * cookie claim, header or request body. `cache` deduplicates the lookup across
 * every server component and route handler in a single request.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const session = await readSession();
  if (!session) return null;

  const user = await prisma.user.findFirst({
    where: { id: session.userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      status: true,
      locale: true,
      emailVerifiedAt: true,
      onboardingDoneAt: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          avatarId: true,
          wilayaId: true,
          communeId: true,
        },
      },
      roles: { select: { role: { select: { name: true } } } },
      organizationMemberships: {
        where: { organization: { deletedAt: null } },
        select: {
          role: true,
          organization: {
            select: { id: true, slug: true, publicName: true, verificationStatus: true },
          },
        },
      },
    },
  });

  if (!user) return null;

  // A suspended or deactivated account keeps no authority, even with a valid
  // session cookie.
  if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') return null;

  const roles = user.roles.map((r) => r.role.name);
  const permissions = new Set<PermissionKey>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role as RoleNameValue] ?? []) {
      permissions.add(permission);
    }
  }

  const firstName = user.profile?.firstName ?? '';
  const lastName = user.profile?.lastName ?? '';

  return {
    sessionId: session.sessionId,
    user: {
      id: user.id,
      email: user.email,
      status: user.status,
      locale: user.locale,
      emailVerified: Boolean(user.emailVerifiedAt),
      firstName,
      lastName,
      displayName:
        user.profile?.displayName?.trim() || `${firstName} ${lastName}`.trim() || 'Membre',
      avatarId: user.profile?.avatarId ?? null,
      wilayaId: user.profile?.wilayaId ?? null,
      communeId: user.profile?.communeId ?? null,
      onboarded: Boolean(user.onboardingDoneAt),
    },
    roles,
    permissions,
    organizations: user.organizationMemberships.map((m) => ({
      organizationId: m.organization.id,
      slug: m.organization.slug,
      publicName: m.organization.publicName,
      role: m.role,
      verificationStatus: m.organization.verificationStatus,
    })),
    isStaff: roles.some((r) => STAFF_ROLES.includes(r as RoleNameValue)),
  };
});

export function hasPermission(auth: AuthContext | null, permission: PermissionKey) {
  return Boolean(auth?.permissions.has(permission));
}

export function hasRole(auth: AuthContext | null, role: RoleName) {
  return Boolean(auth?.roles.includes(role));
}

/** Membership lookup used by every organization-scoped authorization check. */
export function membershipFor(auth: AuthContext | null, organizationId: string) {
  return auth?.organizations.find((o) => o.organizationId === organizationId) ?? null;
}

const ORG_ROLE_RANK: Record<OrgMemberRole, number> = {
  MEMBER: 1,
  MANAGER: 2,
  ADMIN: 3,
  OWNER: 4,
};

export function hasOrgRole(
  auth: AuthContext | null,
  organizationId: string,
  minimum: OrgMemberRole,
) {
  const membership = membershipFor(auth, organizationId);
  if (!membership) return false;
  return ORG_ROLE_RANK[membership.role] >= ORG_ROLE_RANK[minimum];
}
