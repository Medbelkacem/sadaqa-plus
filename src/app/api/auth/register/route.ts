import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { ipOf, readJson } from '@/lib/api/request';
import { requireSameOrigin } from '@/server/auth/guards';
import { register } from '@/server/services/auth.service';
import { registerSchema } from '@/validations/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const input = await readJson(request, registerSchema);
  await register(input, ipOf(request));

  // The response is identical whether or not the address was already
  // registered, so it cannot be used to enumerate accounts.
  return ok({
    message:
      'Si cette adresse peut être utilisée, un e-mail de confirmation vient d’être envoyé.',
  });
});
