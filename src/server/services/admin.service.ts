import 'server-only';

import type { CategoryKind, Prisma, RoleName, UserStatus } from '@prisma/client';
import { revalidateTag } from 'next/cache';

import { errors } from '@/lib/api/errors';
import { paginate } from '@/lib/api/response';
import type { AuthContext } from '@/server/auth/context';
import { revokeAllSessions } from '@/server/auth/session';
import { prisma } from '@/server/db/prisma';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { recordAudit } from '@/server/services/audit.service';

/**
 * Administration.
 *
 * Two invariants run through everything here:
 *  1. An administrator cannot escalate beyond their own level — only a
 *     SUPER_ADMIN may grant ADMIN or SUPER_ADMIN.
 *  2. No one can act on their own account through these endpoints, so a
 *     compromised admin session cannot lock out its owner's colleagues while
 *     protecting itself, and an admin cannot accidentally self-suspend.
 */

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function listUsers(query: {
  page: number;
  pageSize: number;
  q?: string;
  status?: UserStatus;
  role?: RoleName;
}) {
  const where: Prisma.UserWhereInput = { deletedAt: null };

  if (query.status) where.status = query.status;
  if (query.role) where.roles = { some: { role: { name: query.role } } };
  if (query.q) {
    where.OR = [
      { email: { contains: query.q, mode: 'insensitive' } },
      { profile: { firstName: { contains: query.q, mode: 'insensitive' } } },
      { profile: { lastName: { contains: query.q, mode: 'insensitive' } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        lastLoginAt: true,
        profile: { select: { firstName: true, lastName: true, avatarId: true } },
        roles: { select: { role: { select: { name: true } } } },
        _count: { select: { requests: true, organizationMemberships: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return paginate(items, total, query.page, query.pageSize);
}

/** Roles only a SUPER_ADMIN may hand out. */
const PRIVILEGED_ROLES: RoleName[] = ['ADMIN', 'SUPER_ADMIN'];

export async function setUserRole(
  userId: string,
  roleName: RoleName,
  grant: boolean,
  auth: AuthContext,
) {
  if (userId === auth.user.id) {
    throw errors.forbidden('Vous ne pouvez pas modifier vos propres rôles.');
  }

  const isSuperAdmin = auth.roles.includes('SUPER_ADMIN');
  if (PRIVILEGED_ROLES.includes(roleName) && !isSuperAdmin) {
    throw errors.forbidden('Seul un super-administrateur peut attribuer ce rôle.');
  }

  const [user, role] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } }),
    prisma.role.findUnique({ where: { name: roleName }, select: { id: true } }),
  ]);
  if (!user || !role) throw errors.notFound();

  // Never remove the last SUPER_ADMIN — that would lock everyone out.
  if (!grant && roleName === 'SUPER_ADMIN') {
    const remaining = await prisma.userRole.count({
      where: { role: { name: 'SUPER_ADMIN' }, userId: { not: userId } },
    });
    if (remaining === 0) {
      throw errors.conflict('Impossible de retirer le dernier super-administrateur.');
    }
  }

  if (grant) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      create: { userId, roleId: role.id, grantedById: auth.user.id },
      update: {},
    });
  } else {
    await prisma.userRole.deleteMany({ where: { userId, roleId: role.id } });
  }

  await recordAudit({
    actorId: auth.user.id,
    action: grant ? 'USER_ROLE_GRANTED' : 'USER_ROLE_REVOKED',
    targetType: 'USER',
    targetId: userId,
    metadata: { role: roleName },
  });

  return { role: roleName, granted: grant };
}

export async function setUserStatus(userId: string, status: UserStatus, auth: AuthContext) {
  if (userId === auth.user.id) {
    throw errors.forbidden('Vous ne pouvez pas modifier votre propre statut.');
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, status: true, roles: { select: { role: { select: { name: true } } } } },
  });
  if (!target) throw errors.notFound();

  // An ADMIN cannot suspend a SUPER_ADMIN.
  const targetIsSuper = target.roles.some((entry) => entry.role.name === 'SUPER_ADMIN');
  if (targetIsSuper && !auth.roles.includes('SUPER_ADMIN')) {
    throw errors.forbidden();
  }

  await prisma.user.update({ where: { id: userId }, data: { status } });

  // Suspension must take effect immediately, not at the next session expiry.
  if (status === 'SUSPENDED' || status === 'DEACTIVATED') {
    await revokeAllSessions(userId);
  }

  await recordAudit({
    actorId: auth.user.id,
    action: status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
    targetType: 'USER',
    targetId: userId,
    metadata: { from: target.status, to: status },
  });

  return { status };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listAllCategories() {
  return prisma.category.findMany({
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      kind: true,
      slug: true,
      nameFr: true,
      nameAr: true,
      nameEn: true,
      icon: true,
      color: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { requests: true, campaigns: true, events: true, missions: true } },
    },
  });
}

export async function upsertCategory(
  input: {
    id?: string;
    kind: CategoryKind;
    slug: string;
    nameFr: string;
    nameAr: string;
    nameEn: string;
    icon?: string;
    color?: string;
    sortOrder: number;
    isActive: boolean;
  },
  auth: AuthContext,
) {
  const category = input.id
    ? await prisma.category.update({
        where: { id: input.id },
        data: {
          nameFr: input.nameFr,
          nameAr: input.nameAr,
          nameEn: input.nameEn,
          icon: input.icon ?? null,
          color: input.color ?? null,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        },
        select: { id: true, slug: true },
      })
    : await prisma.category.create({
        data: {
          kind: input.kind,
          slug: input.slug,
          nameFr: input.nameFr,
          nameAr: input.nameAr,
          nameEn: input.nameEn,
          icon: input.icon ?? null,
          color: input.color ?? null,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        },
        select: { id: true, slug: true },
      });

  // Categories are cached for an hour; an admin edit must show up at once.
  revalidateTag('categories', 'max');

  await recordAudit({
    actorId: auth.user.id,
    action: 'CATEGORY_CHANGED',
    targetId: category.id,
    metadata: { slug: category.slug, created: !input.id },
  });

  return category;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function listSettings() {
  return prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
}

export async function updateSetting(key: string, value: unknown, auth: AuthContext) {
  const existing = await prisma.systemSetting.findUnique({ where: { key } });
  if (!existing) throw errors.notFound();

  const setting = await prisma.systemSetting.update({
    where: { key },
    data: { value: value as Prisma.InputJsonValue, updatedById: auth.user.id },
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'SETTING_CHANGED',
    targetId: key,
    metadata: { key, previous: existing.value, next: value },
  });

  return setting;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function listAuditLog(query: {
  page: number;
  pageSize: number;
  actorId?: string;
  action?: string;
}) {
  const where: Prisma.AuditLogWhereInput = {};
  if (query.actorId) where.actorId = query.actorId;
  if (query.action) where.action = query.action as Prisma.AuditLogWhereInput['action'];

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            email: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return paginate(items, total, query.page, query.pageSize);
}

/** Guard used by every admin route that mutates platform configuration. */
export function assertPlatformAdmin(auth: AuthContext) {
  if (!auth.permissions.has(PERMISSIONS.SETTING_MANAGE)) throw errors.forbidden();
}
