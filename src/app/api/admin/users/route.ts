import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readQuery } from '@/lib/api/request';
import { requirePermission } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { listUsers } from '@/server/services/admin.service';
import { listUsersQuerySchema } from '@/validations/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async (request: NextRequest) => {
  await requirePermission(PERMISSIONS.USER_READ_ANY);
  const query = readQuery(request, listUsersQuerySchema);
  return ok(await listUsers(query));
});
