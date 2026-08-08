import { handler, ok } from '@/lib/api/response';
import { requireCronSecret } from '@/server/auth/guards';
import { cleanupExpiredRecords } from '@/server/services/scheduled.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Removes expired sessions, consumed tokens and old read notifications. */
export const GET = handler(async () => {
  await requireCronSecret();
  return ok(await cleanupExpiredRecords());
});
