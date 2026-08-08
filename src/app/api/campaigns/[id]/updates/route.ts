import type { NextRequest } from 'next/server';

import { created, handler } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireSameOrigin, requireVerifiedAuth } from '@/server/auth/guards';
import { publishCampaignUpdate } from '@/server/services/campaign.service';
import { campaignUpdateSchema } from '@/validations/campaign';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Publishes a campaign update.
 *
 * Updates are only ever authored by a member of the owning organization —
 * the platform never generates one on their behalf.
 */
export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireSameOrigin();
    const auth = await requireVerifiedAuth();
    const { id } = await context.params;
    const input = await readJson(request, campaignUpdateSchema);
    return created(await publishCampaignUpdate(id, input, auth));
  },
);
