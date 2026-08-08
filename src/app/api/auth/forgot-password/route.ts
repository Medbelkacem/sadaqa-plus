import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { ipOf, readJson } from '@/lib/api/request';
import { requireSameOrigin } from '@/server/auth/guards';
import { requestPasswordReset } from '@/server/services/auth.service';
import { forgotPasswordSchema } from '@/validations/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const input = await readJson(request, forgotPasswordSchema);
  await requestPasswordReset(input, ipOf(request));

  return ok({
    message:
      'Si un compte existe pour cette adresse, un lien de réinitialisation vient d’être envoyé.',
  });
});
