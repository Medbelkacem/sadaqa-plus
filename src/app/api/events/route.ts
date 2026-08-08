import type { NextRequest } from 'next/server';

import { created, handler, ok } from '@/lib/api/response';
import { ipOf, readJson, readQuery } from '@/lib/api/request';
import { requirePermission, requireSameOrigin } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { RATE_LIMITS, enforce } from '@/server/rate-limit';
import { createEvent, listPublicEvents } from '@/server/services/event.service';
import { createEventSchema, listEventsQuerySchema } from '@/validations/event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async (request: NextRequest) => {
  await enforce(RATE_LIMITS.publicApi, ipOf(request));
  const query = readQuery(request, listEventsQuerySchema);
  return ok(await listPublicEvents(query));
});

export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requirePermission(PERMISSIONS.EVENT_CREATE);
  const input = await readJson(request, createEventSchema);
  return created(await createEvent(input, auth));
});
