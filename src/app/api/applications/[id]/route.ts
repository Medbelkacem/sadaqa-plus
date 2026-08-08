import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireAuth, requireSameOrigin } from '@/server/auth/guards';
import { decideApplication } from '@/server/services/volunteer.service';
import { decideApplicationSchema } from '@/validations/volunteer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Accepts or rejects a volunteer application.
 *
 * `decideApplication` re-checks that the caller manages the owning
 * organization and returns 404 otherwise, so an application id from another
 * organization is not actionable.
 */
export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireSameOrigin();
    const auth = await requireAuth();
    const { id } = await context.params;
    const input = await readJson(request, decideApplicationSchema);
    return ok(await decideApplication(id, input.decision, input.note, auth));
  },
);
