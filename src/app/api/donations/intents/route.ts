import type { NextRequest } from 'next/server';

import { created, handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireSameOrigin, requireVerifiedAuth } from '@/server/auth/guards';
import { RATE_LIMITS, enforce } from '@/server/rate-limit';
import { createDonationIntent, listIntentsForUser } from '@/server/services/donation.service';
import { paginationSchema } from '@/validations/common';
import { donationIntentSchema } from '@/validations/interaction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async (request: NextRequest) => {
  const auth = await requireVerifiedAuth();
  const url = new URL(request.url);
  const { page, pageSize } = paginationSchema.parse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
  });
  return ok(await listIntentsForUser(auth.user.id, page, pageSize));
});

/**
 * Declares an intent to help.
 *
 * This is NOT a donation. It records interest and notifies whoever can act on
 * it. It is never summed into any total and never produces a receipt.
 */
export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requireVerifiedAuth();
  await enforce(RATE_LIMITS.donationIntent, auth.user.id);

  const input = await readJson(request, donationIntentSchema);
  return created(await createDonationIntent(input, auth));
});
