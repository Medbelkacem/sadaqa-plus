import type { NextRequest } from 'next/server';

import { handler, noContent, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireAuth, requireSameOrigin, requireVerifiedAuth } from '@/server/auth/guards';
import {
  getRequestForActor,
  softDeleteRequest,
  updateRequest,
} from '@/server/services/request.service';
import { createRequestSchema } from '@/validations/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Full record, for the author, an organization colleague or a moderator.
 * `getRequestForActor` throws a 404 for anyone else, so an id in the URL
 * cannot be used to probe for existence.
 */
export const GET = handler(async (_request: NextRequest, context: RouteContext) => {
  const { id } = await context.params;
  const auth = await requireAuth();
  const result = await getRequestForActor(id, auth);
  return ok(result);
});

export const PATCH = handler(async (request: NextRequest, context: RouteContext) => {
  await requireSameOrigin();
  const { id } = await context.params;
  const auth = await requireVerifiedAuth();
  const input = await readJson(request, createRequestSchema);
  const result = await updateRequest(id, input, auth);
  return ok(result);
});

export const DELETE = handler(async (_request: NextRequest, context: RouteContext) => {
  await requireSameOrigin();
  const { id } = await context.params;
  const auth = await requireAuth();
  await softDeleteRequest(id, auth);
  return noContent();
});
