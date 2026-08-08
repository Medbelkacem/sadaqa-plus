import type { NextRequest } from 'next/server';

import { created, handler, noContent } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireSameOrigin, requireVerifiedAuth } from '@/server/auth/guards';
import { cancelRegistration, registerForEvent } from '@/server/services/event.service';
import { registerForEventSchema } from '@/validations/event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Registers the caller for an event.
 *
 * The user id comes from the session, never the body, so one account cannot
 * register another. Capacity is enforced inside a transaction; a full event
 * returns a WAITLISTED registration rather than an error.
 */
export const POST = handler(async (request: NextRequest, context: RouteContext) => {
  await requireSameOrigin();
  const auth = await requireVerifiedAuth();
  const { id } = await context.params;
  const input = await readJson(request, registerForEventSchema);
  return created(await registerForEvent(id, auth, input.kind, input.note));
});

export const DELETE = handler(async (_request: NextRequest, context: RouteContext) => {
  await requireSameOrigin();
  const auth = await requireVerifiedAuth();
  const { id } = await context.params;
  await cancelRegistration(id, auth);
  return noContent();
});
