import { NextResponse, type NextRequest } from 'next/server';

import { toApiFailure } from '@/lib/api/response';
import { paymentProvider } from '@/server/payments';
import { applyProviderState } from '@/server/services/donation.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Payment provider callback.
 *
 * The ONLY path by which a donation can reach CONFIRMED. Deliberately:
 *  - no session, no CSRF token — the caller is a server, not a browser;
 *  - the raw body is read before parsing so the signature is verified over
 *    exactly the bytes that were signed;
 *  - `verifyWebhook` throws on an invalid signature, and with no provider
 *    configured it always throws, so this endpoint cannot be used to fabricate
 *    a confirmed donation.
 */
export async function POST(request: NextRequest) {
  try {
    const provider = paymentProvider();
    const rawBody = await request.text();

    const result = await provider.verifyWebhook(rawBody, request.headers);
    const applied = await applyProviderState(result.providerRef, result.status, result.reason);

    // Acknowledge with 200 so the provider stops retrying.
    return NextResponse.json({ received: true, changed: applied.changed });
  } catch (error) {
    console.error('[payments] webhook rejected', error);
    return toApiFailure(error);
  }
}
