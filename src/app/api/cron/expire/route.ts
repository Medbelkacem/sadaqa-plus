import { handler, ok } from '@/lib/api/response';
import { requireCronSecret } from '@/server/auth/guards';
import { expireStaleRequests } from '@/server/services/scheduled.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Expires stale requests and closes finished campaigns/events. */
export const GET = handler(async () => {
  await requireCronSecret();
  return ok(await expireStaleRequests());
});
