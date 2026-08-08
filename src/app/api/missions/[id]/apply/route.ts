import type { NextRequest } from 'next/server';

import { created, handler, noContent } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requirePermission, requireSameOrigin } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { applyToMission, withdrawApplication } from '@/server/services/volunteer.service';
import { applyToMissionSchema } from '@/validations/volunteer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export const POST = handler(async (request: NextRequest, context: RouteContext) => {
  await requireSameOrigin();
  const auth = await requirePermission(PERMISSIONS.VOLUNTEER_APPLY);
  const { id } = await context.params;
  const input = await readJson(request, applyToMissionSchema);
  return created(await applyToMission(id, input.message, auth));
});

export const DELETE = handler(async (_request: NextRequest, context: RouteContext) => {
  await requireSameOrigin();
  const auth = await requirePermission(PERMISSIONS.VOLUNTEER_APPLY);
  const { id } = await context.params;
  await withdrawApplication(id, auth);
  return noContent();
});
