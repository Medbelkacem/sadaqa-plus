import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { handler, ok } from '@/lib/api/response';
import { readQuery } from '@/lib/api/request';
import { getCommunes } from '@/server/services/reference.service';
import { wilayaIdSchema } from '@/validations/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({ wilayaId: wilayaIdSchema });

/** Communes of one wilaya — the cascading select behind every location field. */
export const GET = handler(async (request: NextRequest) => {
  const { wilayaId } = readQuery(request, querySchema);
  const communes = await getCommunes(wilayaId);
  return ok(communes, undefined, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
});
