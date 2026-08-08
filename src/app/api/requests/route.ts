import type { NextRequest } from 'next/server';

import { created, handler, ok } from '@/lib/api/response';
import { errors } from '@/lib/api/errors';
import { ipOf, readJson, readQuery } from '@/lib/api/request';
import { requireSameOrigin, requireVerifiedAuth } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { RATE_LIMITS, enforce } from '@/server/rate-limit';
import { createRequest, listPublicRequests } from '@/server/services/request.service';
import { createRequestSchema, listRequestsQuerySchema } from '@/validations/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public listing. Only ever returns publicly visible statuses. */
export const GET = handler(async (request: NextRequest) => {
  await enforce(RATE_LIMITS.publicApi, ipOf(request));
  const query = readQuery(request, listRequestsQuerySchema);
  const result = await listPublicRequests(query);
  return ok(result);
});

export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requireVerifiedAuth();

  // Permission comes from the database-derived role set, never the request body.
  if (!auth.permissions.has(PERMISSIONS.REQUEST_CREATE)) throw errors.forbidden();

  await enforce(RATE_LIMITS.requestCreate, auth.user.id);

  const input = await readJson(request, createRequestSchema);
  const result = await createRequest(input, auth);

  return created(result);
});
