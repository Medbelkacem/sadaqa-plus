import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { ipOf, readJson } from '@/lib/api/request';
import { requireSameOrigin } from '@/server/auth/guards';
import { resendVerification } from '@/server/services/auth.service';
import { resendVerificationSchema } from '@/validations/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const { email } = await readJson(request, resendVerificationSchema);
  await resendVerification(email, ipOf(request));
  return ok({ message: 'Si une confirmation est en attente, un nouvel e-mail a été envoyé.' });
});
