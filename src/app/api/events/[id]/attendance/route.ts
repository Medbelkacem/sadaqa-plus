import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireAuth, requireSameOrigin } from '@/server/auth/guards';
import { RATE_LIMITS, enforce } from '@/server/rate-limit';
import { recordAttendance } from '@/server/services/event.service';
import { attendanceScanSchema } from '@/validations/event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Records attendance from a scanned participation code.
 *
 * The code is an HMAC over the registration id keyed by a per-event secret,
 * so it cannot be forged or reused across events. Duplicate scans return
 * `alreadyCheckedIn: true` instead of an error — a volunteer scanning twice
 * is normal, not a fault.
 */
export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireSameOrigin();
    const auth = await requireAuth();
    const { id } = await context.params;

    // Rate limited per scanner: a stolen session should not be able to brute
    // force codes.
    await enforce(RATE_LIMITS.attendanceScan, `${auth.user.id}:${id}`);

    const input = await readJson(request, attendanceScanSchema);
    return ok(await recordAttendance(id, input.code, auth));
  },
);
