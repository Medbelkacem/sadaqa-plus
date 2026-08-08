import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireAnyPermission, requireSameOrigin } from '@/server/auth/guards';
import { errors } from '@/lib/api/errors';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { setUserRole, setUserStatus } from '@/server/services/admin.service';
import { updateUserSchema } from '@/validations/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Role and status changes.
 *
 * The service enforces the escalation rules (only SUPER_ADMIN grants
 * ADMIN/SUPER_ADMIN, nobody may act on their own account, the last
 * SUPER_ADMIN cannot be demoted). This route only checks that the caller holds
 * the corresponding capability at all.
 */
export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireSameOrigin();
    const auth = await requireAnyPermission(
      PERMISSIONS.USER_ROLE_MANAGE,
      PERMISSIONS.USER_SUSPEND,
    );

    const { id } = await context.params;
    const input = await readJson(request, updateUserSchema);

    if (input.op === 'set_status') {
      if (!auth.permissions.has(PERMISSIONS.USER_SUSPEND)) throw errors.forbidden();
      return ok(await setUserStatus(id, input.status, auth));
    }

    if (!auth.permissions.has(PERMISSIONS.USER_ROLE_MANAGE)) throw errors.forbidden();
    return ok(await setUserRole(id, input.role, input.op === 'grant_role', auth));
  },
);
