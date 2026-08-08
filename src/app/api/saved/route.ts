import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireAuth, requireSameOrigin } from '@/server/auth/guards';
import { listSaved, toggleSaved } from '@/server/services/saved.service';
import { paginationSchema } from '@/validations/common';
import { toggleSavedSchema } from '@/validations/interaction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async (request: NextRequest) => {
  const auth = await requireAuth();
  const url = new URL(request.url);
  const { page, pageSize } = paginationSchema.parse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
  });
  // Always scoped to the caller's own id — never a parameter.
  return ok(await listSaved(auth.user.id, page, pageSize));
});

export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requireAuth();
  const input = await readJson(request, toggleSavedSchema);
  return ok(await toggleSaved(auth.user.id, input.targetType, input.targetId));
});
