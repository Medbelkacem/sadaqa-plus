import { handler, ok } from '@/lib/api/response';
import { getAuthContext } from '@/server/auth/context';
import { requireSameOrigin } from '@/server/auth/guards';
import { logout } from '@/server/services/auth.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handler(async () => {
  await requireSameOrigin();
  const auth = await getAuthContext();
  await logout(auth?.user.id);
  return ok({ message: 'Déconnecté.' });
});
