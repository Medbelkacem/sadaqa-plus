import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readQuery } from '@/lib/api/request';
import { requirePermission } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { listAuditLog } from '@/server/services/admin.service';
import { listAuditQuerySchema } from '@/validations/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Read-only. Nothing in the application can edit or delete an audit entry. */
export const GET = handler(async (request: NextRequest) => {
  await requirePermission(PERMISSIONS.AUDIT_READ);
  const query = readQuery(request, listAuditQuerySchema);
  return ok(await listAuditLog(query));
});
