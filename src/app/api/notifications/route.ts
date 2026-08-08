import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { handler, ok } from '@/lib/api/response';
import { readQuery } from '@/lib/api/request';
import { requireAuth, requireSameOrigin } from '@/server/auth/guards';
import { prisma } from '@/server/db/prisma';
import { paginate } from '@/lib/api/response';
import { paginationSchema } from '@/validations/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = paginationSchema.extend({
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

/** Always scoped to the caller. There is no way to read another user's feed. */
export const GET = handler(async (request: NextRequest) => {
  const auth = await requireAuth();
  const { page, pageSize, unreadOnly } = readQuery(request, querySchema);

  const where = {
    userId: auth.user.id,
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        url: true,
        targetType: true,
        targetId: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: auth.user.id, readAt: null } }),
  ]);

  return ok(paginate(items, total, page, pageSize), { unread });
});

/** Marks everything read. */
export const POST = handler(async () => {
  await requireSameOrigin();
  const auth = await requireAuth();

  const result = await prisma.notification.updateMany({
    where: { userId: auth.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return ok({ markedRead: result.count });
});
