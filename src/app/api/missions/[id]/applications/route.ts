import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { requireAuth } from '@/server/auth/guards';
import { listApplicationsForMission } from '@/server/services/volunteer.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Applications for one mission.
 *
 * Only members of the owning organization (or a moderator) can read them —
 * volunteer profiles contain personal data and are never listed publicly.
 */
export const GET = handler(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const auth = await requireAuth();
    const { id } = await context.params;
    return ok(await listApplicationsForMission(id, auth));
  },
);
