import 'server-only';

import type { Prisma, TargetType } from '@prisma/client';

import { paginate } from '@/lib/api/response';
import { prisma } from '@/server/db/prisma';

/** Bookmarks. Scoped to the owner by construction — no cross-user reads exist. */

export async function toggleSaved(userId: string, targetType: TargetType, targetId: string) {
  const existing = await prisma.savedItem.findUnique({
    where: { userId_targetType_targetId: { userId, targetType, targetId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.savedItem.delete({ where: { id: existing.id } });
    return { saved: false as const };
  }

  await prisma.savedItem.create({ data: { userId, targetType, targetId } });
  return { saved: true as const };
}

export async function isSaved(userId: string, targetType: TargetType, targetId: string) {
  const row = await prisma.savedItem.findUnique({
    where: { userId_targetType_targetId: { userId, targetType, targetId } },
    select: { id: true },
  });
  return Boolean(row);
}

/**
 * The saved list, resolved to real records.
 *
 * Anything the user saved that has since been deleted or unpublished simply
 * does not come back — the bookmark row is left in place so it reappears if
 * the item is restored.
 */
export async function listSaved(userId: string, page: number, pageSize: number) {
  const where: Prisma.SavedItemWhereInput = { userId };

  const [rows, total] = await Promise.all([
    prisma.savedItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.savedItem.count({ where }),
  ]);

  const byType = {
    REQUEST: rows.filter((r) => r.targetType === 'REQUEST').map((r) => r.targetId),
    CAMPAIGN: rows.filter((r) => r.targetType === 'CAMPAIGN').map((r) => r.targetId),
    EVENT: rows.filter((r) => r.targetType === 'EVENT').map((r) => r.targetId),
  };

  const [requests, campaigns, events] = await Promise.all([
    byType.REQUEST.length
      ? prisma.request.findMany({
          where: { id: { in: byType.REQUEST }, deletedAt: null },
          select: { id: true, slug: true, title: true, status: true, urgency: true },
        })
      : [],
    byType.CAMPAIGN.length
      ? prisma.campaign.findMany({
          where: { id: { in: byType.CAMPAIGN }, deletedAt: null },
          select: { id: true, slug: true, title: true, status: true },
        })
      : [],
    byType.EVENT.length
      ? prisma.event.findMany({
          where: { id: { in: byType.EVENT }, deletedAt: null },
          select: { id: true, slug: true, title: true, status: true, startsAt: true },
        })
      : [],
  ]);

  const lookup = new Map<string, unknown>();
  for (const item of [...requests, ...campaigns, ...events]) lookup.set(item.id, item);

  const items = rows
    .map((row) => ({
      savedAt: row.createdAt,
      targetType: row.targetType,
      item: lookup.get(row.targetId) ?? null,
    }))
    .filter((entry) => entry.item !== null);

  return paginate(items, total, page, pageSize);
}
