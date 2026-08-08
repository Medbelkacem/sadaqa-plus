import { handler, ok } from '@/lib/api/response';
import { requireCronSecret } from '@/server/auth/guards';
import { flushOutbox } from '@/server/services/email/email.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Retries undelivered transactional email.
 * Reports `skipped: true` when SMTP is not configured, rather than pretending
 * to have flushed anything.
 */
export const GET = handler(async () => {
  await requireCronSecret();
  return ok(await flushOutbox(50));
});
