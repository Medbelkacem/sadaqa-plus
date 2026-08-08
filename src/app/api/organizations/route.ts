import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { ipOf, readQuery } from '@/lib/api/request';
import { RATE_LIMITS, enforce } from '@/server/rate-limit';
import { listVerifiedOrganizations } from '@/server/services/organization.service';
import { listOrganizationsQuerySchema } from '@/validations/organization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public partner directory. Only VERIFIED organizations are ever returned. */
export const GET = handler(async (request: NextRequest) => {
  await enforce(RATE_LIMITS.publicApi, ipOf(request));
  const query = readQuery(request, listOrganizationsQuerySchema);
  return ok(await listVerifiedOrganizations(query));
});
