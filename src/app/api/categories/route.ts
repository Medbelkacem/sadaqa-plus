import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { handler, ok } from '@/lib/api/response';
import { readQuery } from '@/lib/api/request';
import { getCategories } from '@/server/services/reference.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  kind: z.enum(['REQUEST', 'CAMPAIGN', 'EVENT', 'MISSION']).default('REQUEST'),
});

export const GET = handler(async (request: NextRequest) => {
  const { kind } = readQuery(request, querySchema);
  const categories = await getCategories(kind);
  return ok(categories);
});
