import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireAuth, requireSameOrigin } from '@/server/auth/guards';
import { changePassword } from '@/server/services/auth.service';
import { changePasswordSchema } from '@/validations/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requireAuth();
  const input = await readJson(request, changePasswordSchema);

  await changePassword(auth.user.id, auth.sessionId, input.currentPassword, input.password);

  return ok({ message: 'Mot de passe mis à jour. Vos autres sessions ont été déconnectées.' });
});
