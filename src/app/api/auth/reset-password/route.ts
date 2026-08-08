import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireSameOrigin } from '@/server/auth/guards';
import { resetPassword } from '@/server/services/auth.service';
import { resetPasswordSchema } from '@/validations/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const input = await readJson(request, resetPasswordSchema);
  await resetPassword(input);
  return ok({ message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' });
});
