import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requirePermission, requireSameOrigin } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { moderateRequest } from '@/server/services/request.service';
import { moderateRequestSchema } from '@/validations/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Moderation decision on a help request.
 *
 * Guarded by `request:moderate`, which only MODERATOR and above hold. The
 * service additionally enforces the state machine, so an authorized moderator
 * still cannot drive an illegal transition.
 */
export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireSameOrigin();
    const auth = await requirePermission(PERMISSIONS.REQUEST_MODERATE);
    const { id } = await context.params;
    const input = await readJson(request, moderateRequestSchema);
    const result = await moderateRequest(id, input, auth);
    return ok(result);
  },
);
