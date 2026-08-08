import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { handler, ok } from '@/lib/api/response';
import { ipOf, readQuery } from '@/lib/api/request';
import { RATE_LIMITS, enforce } from '@/server/rate-limit';
import { searchProvider, type SearchKind } from '@/server/services/search.service';
import { csvOf } from '@/validations/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  q: z.string().trim().max(120).default(''),
  kinds: csvOf(z.enum(['requests', 'campaigns', 'events', 'organizations'])),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export const GET = handler(async (request: NextRequest) => {
  await enforce(RATE_LIMITS.search, ipOf(request));

  const { q, kinds, limit } = readQuery(request, querySchema);
  const results = await searchProvider().search(q, (kinds ?? []) as SearchKind[], limit);

  return ok(results);
});
