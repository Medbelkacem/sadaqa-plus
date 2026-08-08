import type { NextRequest } from 'next/server';

import { handler, ok } from '@/lib/api/response';
import { ipOf, readJson } from '@/lib/api/request';
import { requireSameOrigin } from '@/server/auth/guards';
import { login } from '@/server/services/auth.service';
import { loginSchema } from '@/validations/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const input = await readJson(request, loginSchema);
  const result = await login(input, ipOf(request));

  return ok({
    userId: result.userId,
    emailVerified: result.emailVerified,
  });
});
