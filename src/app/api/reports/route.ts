import type { NextRequest } from 'next/server';

import { created, handler } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireSameOrigin, requireVerifiedAuth } from '@/server/auth/guards';
import { RATE_LIMITS, enforce } from '@/server/rate-limit';
import { createReport } from '@/server/services/moderation.service';
import { createReportSchema } from '@/validations/interaction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Files a content report.
 *
 * Filing a report never changes the reported item's state — it queues a human
 * review. Rate limited so the report queue cannot be used to bury moderators.
 */
export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requireVerifiedAuth();
  await enforce(RATE_LIMITS.reportCreate, auth.user.id);

  const input = await readJson(request, createReportSchema);
  const result = await createReport(input, auth);

  return created(result);
});
