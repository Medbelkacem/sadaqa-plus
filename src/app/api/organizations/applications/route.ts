import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { handler, ok } from '@/lib/api/response';
import { readQuery } from '@/lib/api/request';
import { requirePermission } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { listPartnerApplications } from '@/server/services/organization.service';
import { paginationSchema } from '@/validations/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']).optional(),
});

/** Review queue. Requires `partner_application:review` (ADMIN and above). */
export const GET = handler(async (request: NextRequest) => {
  await requirePermission(PERMISSIONS.PARTNER_APPLICATION_REVIEW);
  const { status, page, pageSize } = readQuery(request, querySchema);
  return ok(await listPartnerApplications(status, page, pageSize));
});
