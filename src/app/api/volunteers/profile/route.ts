import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireAuth, requireSameOrigin, requireVerifiedAuth } from '@/server/auth/guards';
import { getVolunteerProfile, upsertVolunteerProfile } from '@/server/services/volunteer.service';
import { volunteerProfileSchema } from '@/validations/volunteer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Always the caller's own profile — there is no id parameter to tamper with. */
export const GET = handler(async () => {
  const auth = await requireAuth();
  return ok(await getVolunteerProfile(auth.user.id));
});

export const PUT = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requireVerifiedAuth();
  const input = await readJson(request, volunteerProfileSchema);
  return ok(await upsertVolunteerProfile(input, auth));
});
