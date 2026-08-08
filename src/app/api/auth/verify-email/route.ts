import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireSameOrigin } from '@/server/auth/guards';
import { verifyEmail } from '@/server/services/auth.service';
import { verifyEmailSchema } from '@/validations/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const { token } = await readJson(request, verifyEmailSchema);
  await verifyEmail(token);
  return ok({ message: 'Adresse e-mail confirmée.' });
});
