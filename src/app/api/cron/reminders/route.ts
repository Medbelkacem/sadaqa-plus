import { handler, ok } from '@/lib/api/response';
import { requireCronSecret } from '@/server/auth/guards';
import { sendEventReminders } from '@/server/services/scheduled.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Event reminders, 24–48h ahead. Guarded by CRON_SECRET. */
export const GET = handler(async () => {
  await requireCronSecret();
  return ok(await sendEventReminders());
});
