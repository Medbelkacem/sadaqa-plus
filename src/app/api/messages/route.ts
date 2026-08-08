import type { NextRequest } from 'next/server';

import { created, handler, ok } from '@/lib/api/response';
import { readJson, readQuery } from '@/lib/api/request';
import { requireAuth, requireSameOrigin, requireVerifiedAuth } from '@/server/auth/guards';
import { listConversations, openConversation } from '@/server/services/messaging.service';
import { paginationSchema } from '@/validations/common';
import { openConversationSchema } from '@/validations/messaging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The caller's own conversations. The user id is never a parameter. */
export const GET = handler(async (request: NextRequest) => {
  const auth = await requireAuth();
  const { page, pageSize } = readQuery(request, paginationSchema);
  return ok(await listConversations(auth.user.id, page, pageSize));
});

export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requireVerifiedAuth();
  const input = await readJson(request, openConversationSchema);
  return created(await openConversation(input, auth));
});
