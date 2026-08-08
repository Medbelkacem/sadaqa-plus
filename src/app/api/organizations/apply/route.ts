import type { NextRequest } from 'next/server';

import { created, handler } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requirePermission, requireSameOrigin } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { RATE_LIMITS, enforce } from '@/server/rate-limit';
import { submitPartnerApplication } from '@/server/services/organization.service';
import { partnerApplicationSchema } from '@/validations/organization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Submits a partnership application.
 *
 * Creates an application, never an organization. The organization row only
 * comes into existence when an administrator approves it.
 */
export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requirePermission(PERMISSIONS.PARTNER_APPLICATION_SUBMIT);
  await enforce(RATE_LIMITS.requestCreate, `partner:${auth.user.id}`);

  const input = await readJson(request, partnerApplicationSchema);
  return created(await submitPartnerApplication(input, auth));
});
