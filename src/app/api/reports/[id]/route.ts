import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requirePermission, requireSameOrigin } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { resolveReport } from '@/server/services/moderation.service';
import { resolveReportSchema } from '@/validations/interaction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireSameOrigin();
    const auth = await requirePermission(PERMISSIONS.REPORT_MODERATE);
    const { id } = await context.params;
    const input = await readJson(request, resolveReportSchema);
    return ok(await resolveReport(id, input, auth));
  },
);
