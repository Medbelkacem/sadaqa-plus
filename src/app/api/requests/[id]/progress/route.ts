import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireSameOrigin, requireVerifiedAuth } from '@/server/auth/guards';
import { updateRequestProgress } from '@/server/services/request.service';
import { updateRequestProgressSchema } from '@/validations/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Author-driven progress: "partially helped", "completed", or back to active. */
export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireSameOrigin();
    const auth = await requireVerifiedAuth();
    const { id } = await context.params;
    const input = await readJson(request, updateRequestProgressSchema);
    const result = await updateRequestProgress(id, input.status, input.note, auth);
    return ok(result);
  },
);
