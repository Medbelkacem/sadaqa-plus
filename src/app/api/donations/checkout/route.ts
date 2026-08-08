import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireSameOrigin, requireVerifiedAuth } from '@/server/auth/guards';
import { startDonation } from '@/server/services/donation.service';
import { startDonationSchema } from '@/validations/interaction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Starts a real monetary donation.
 *
 * With no payment provider configured this returns 503
 * SERVICE_NOT_CONFIGURED, which the UI renders as "online payment is not
 * configured yet". It never returns a fake success.
 */
export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requireVerifiedAuth();
  const input = await readJson(request, startDonationSchema);
  return ok(await startDonation(input, auth));
});
