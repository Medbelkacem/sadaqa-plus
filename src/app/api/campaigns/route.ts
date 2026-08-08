import type { NextRequest } from 'next/server';

import { created, handler, ok } from '@/lib/api/response';
import { ipOf, readJson, readQuery } from '@/lib/api/request';
import { requirePermission, requireSameOrigin } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { RATE_LIMITS, enforce } from '@/server/rate-limit';
import { createCampaign, listPublicCampaigns } from '@/server/services/campaign.service';
import { createCampaignSchema, listCampaignsQuerySchema } from '@/validations/campaign';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async (request: NextRequest) => {
  await enforce(RATE_LIMITS.publicApi, ipOf(request));
  const query = readQuery(request, listCampaignsQuerySchema);
  return ok(await listPublicCampaigns(query));
});

export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requirePermission(PERMISSIONS.CAMPAIGN_CREATE);
  const input = await readJson(request, createCampaignSchema);
  return created(await createCampaign(input, auth));
});
