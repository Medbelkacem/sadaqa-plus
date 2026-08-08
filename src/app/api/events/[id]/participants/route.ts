import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { requireAuth } from '@/server/auth/guards';
import { listEventParticipants } from '@/server/services/event.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Participant list for an event.
 *
 * Restricted to members of the organizing organization and to moderators.
 * A stranger passing a valid event id receives a 404, not a roster.
 */
export const GET = handler(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const auth = await requireAuth();
    const { id } = await context.params;
    return ok(await listEventParticipants(id, auth));
  },
);
