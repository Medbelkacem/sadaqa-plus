import type { NextRequest } from 'next/server';

import { created, handler, ok } from '@/lib/api/response';
import { readJson, readQuery } from '@/lib/api/request';
import { requireAuth, requireSameOrigin, requireVerifiedAuth } from '@/server/auth/guards';
import { RATE_LIMITS, enforce } from '@/server/rate-limit';
import { getConversation, sendMessage } from '@/server/services/messaging.service';
import { listMessagesQuerySchema, sendMessageSchema } from '@/validations/messaging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Reads one conversation.
 *
 * `getConversation` resolves the caller's membership first and throws 404 if
 * there is none, so a conversation id belonging to other people is not
 * readable and not even distinguishable from a non-existent one.
 */
export const GET = handler(async (request: NextRequest, context: RouteContext) => {
  const auth = await requireAuth();
  const { id } = await context.params;
  const { page, pageSize } = readQuery(request, listMessagesQuerySchema);
  return ok(await getConversation(id, auth, page, pageSize));
});

export const POST = handler(async (request: NextRequest, context: RouteContext) => {
  await requireSameOrigin();
  const auth = await requireVerifiedAuth();
  await enforce(RATE_LIMITS.messageSend, auth.user.id);

  const { id } = await context.params;
  const input = await readJson(request, sendMessageSchema);
  return created(await sendMessage(id, input, auth));
});
