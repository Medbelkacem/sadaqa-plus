import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requirePermission, requireSameOrigin } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { decidePartnerApplication } from '@/server/services/organization.service';
import { decidePartnerApplicationSchema } from '@/validations/organization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Records a decision on a partnership application.
 *
 * Approval is transactional: it creates the organization, makes the applicant
 * its OWNER, grants the ORGANIZATION role and writes the verification record
 * together, so a half-approved partner cannot exist.
 */
export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireSameOrigin();
    const auth = await requirePermission(PERMISSIONS.PARTNER_APPLICATION_REVIEW);
    const { id } = await context.params;
    const input = await readJson(request, decidePartnerApplicationSchema);
    return ok(await decidePartnerApplication(id, input, auth));
  },
);
