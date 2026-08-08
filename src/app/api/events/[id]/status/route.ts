import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireAuth, requireSameOrigin } from '@/server/auth/guards';
import { changeEventStatus } from '@/server/services/event.service';
import { eventStatusSchema } from '@/validations/event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ status: eventStatusSchema });

export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireSameOrigin();
    const auth = await requireAuth();
    const { id } = await context.params;
    const { status } = await readJson(request, bodySchema);
    return ok(await changeEventStatus(id, status, auth));
  },
);
