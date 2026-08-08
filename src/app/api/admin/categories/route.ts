import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requirePermission, requireSameOrigin } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { listAllCategories, upsertCategory } from '@/server/services/admin.service';
import { categorySchema } from '@/validations/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requirePermission(PERMISSIONS.CATEGORY_MANAGE);
  return ok(await listAllCategories());
});

/**
 * Creates or updates a category.
 *
 * Categories are reference data an administrator owns at runtime — the seed
 * only supplies a starting set. Deactivating a category hides it from new
 * submissions without orphaning the records that already use it.
 */
export const PUT = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requirePermission(PERMISSIONS.CATEGORY_MANAGE);
  const input = await readJson(request, categorySchema);
  return ok(await upsertCategory(input, auth));
});
