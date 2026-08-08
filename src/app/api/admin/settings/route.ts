import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requirePermission, requireSameOrigin } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { listSettings, updateSetting } from '@/server/services/admin.service';
import { updateSettingSchema } from '@/validations/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requirePermission(PERMISSIONS.SETTING_MANAGE);
  return ok(await listSettings());
});

export const PUT = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requirePermission(PERMISSIONS.SETTING_MANAGE);
  const input = await readJson(request, updateSettingSchema);
  return ok(await updateSetting(input.key, input.value, auth));
});
