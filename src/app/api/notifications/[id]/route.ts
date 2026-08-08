import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { errors } from '@/lib/api/errors';
import { requireAuth, requireSameOrigin } from '@/server/auth/guards';
import { prisma } from '@/server/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Marks one notification read.
 *
 * The update is filtered by both id AND userId, so passing someone else's
 * notification id changes nothing and reports 404.
 */
export const POST = handler(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireSameOrigin();
    const auth = await requireAuth();
    const { id } = await context.params;

    const result = await prisma.notification.updateMany({
      where: { id, userId: auth.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    if (result.count === 0) throw errors.notFound();
    return ok({ read: true });
  },
);
