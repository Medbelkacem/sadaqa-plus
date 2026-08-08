import type { NextRequest } from 'next/server';

import { created, handler, ok } from '@/lib/api/response';
import { ipOf, readJson, readQuery } from '@/lib/api/request';
import { requirePermission, requireSameOrigin } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { RATE_LIMITS, enforce } from '@/server/rate-limit';
import { createMission, listPublicMissions } from '@/server/services/volunteer.service';
import { createMissionSchema, listMissionsQuerySchema } from '@/validations/volunteer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async (request: NextRequest) => {
  await enforce(RATE_LIMITS.publicApi, ipOf(request));
  const query = readQuery(request, listMissionsQuerySchema);
  return ok(await listPublicMissions(query));
});

export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requirePermission(PERMISSIONS.MISSION_CREATE);
  const input = await readJson(request, createMissionSchema);
  return created(await createMission(input, auth));
});
