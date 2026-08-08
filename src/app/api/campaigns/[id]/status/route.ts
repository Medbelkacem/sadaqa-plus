import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireAuth, requireSameOrigin } from '@/server/auth/guards';
import { changeCampaignStatus } from '@/server/services/campaign.service';
import { changeCampaignStatusSchema } from '@/validations/campaign';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Moves a campaign through its lifecycle.
 *
 * The service decides who may do what: an organization can pause or complete
 * its own campaign, but publishing a PENDING_REVIEW campaign requires
 * `campaign:moderate` — an organization cannot approve itself.
 */
export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireSameOrigin();
    const auth = await requireAuth();
    const { id } = await context.params;
    const input = await readJson(request, changeCampaignStatusSchema);
    return ok(await changeCampaignStatus(id, input.status, auth, input.reason));
  },
);
