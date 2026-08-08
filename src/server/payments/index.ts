import 'server-only';

import { serverEnv } from '@/config/env';
import { errors } from '@/lib/api/errors';

/**
 * Payment provider boundary.
 *
 * Sadaqa+ ships with NO payment provider connected. The default
 * implementation is not a mock that pretends to succeed — it is an explicit
 * "not configured" adapter that refuses every operation, so the UI can say so
 * plainly and no donation can ever reach CONFIRMED without a real provider.
 *
 * To connect a provider (SATIM/CIB, Edahabia via Chargily, or a bank
 * gateway): implement `PaymentProvider`, register it in `paymentProvider()`,
 * and set PAYMENT_PROVIDER + credentials. The webhook route already verifies
 * signatures through `verifyWebhook`.
 */

export type CheckoutRequest = {
  donationId: string;
  reference: string;
  amount: number;
  currency: string;
  description: string;
};

export type CheckoutResult = {
  providerRef: string;
  redirectUrl: string;
};

export type WebhookResult = {
  providerRef: string;
  status: 'CONFIRMED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  reason?: string;
};

export interface PaymentProvider {
  readonly name: string;
  readonly configured: boolean;

  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;

  /**
   * Verifies the authenticity of a provider callback and returns the state
   * change it carries. Must throw if the signature does not verify — this is
   * the only thing standing between a stranger and a CONFIRMED donation.
   */
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookResult>;
}

class UnconfiguredPaymentProvider implements PaymentProvider {
  readonly name = 'none';
  readonly configured = false;

  async createCheckout(): Promise<CheckoutResult> {
    throw errors.notConfigured('Le paiement en ligne');
  }

  async verifyWebhook(): Promise<WebhookResult> {
    throw errors.notConfigured('Le paiement en ligne');
  }
}

let cached: PaymentProvider | null = null;

export function paymentProvider(): PaymentProvider {
  if (cached) return cached;

  const env = serverEnv();

  switch (env.PAYMENT_PROVIDER) {
    case 'satim':
    case 'chargily': {
      // Credentials present but no adapter compiled in: fail loudly rather
      // than silently falling back to a permissive stub.
      if (!env.PAYMENT_PROVIDER_KEY || !env.PAYMENT_PROVIDER_SECRET) {
        console.warn(
          `[payments] PAYMENT_PROVIDER=${env.PAYMENT_PROVIDER} but credentials are missing; online payment stays disabled.`,
        );
        cached = new UnconfiguredPaymentProvider();
        break;
      }
      console.warn(
        `[payments] No adapter is implemented for "${env.PAYMENT_PROVIDER}". Implement PaymentProvider and register it here before going live.`,
      );
      cached = new UnconfiguredPaymentProvider();
      break;
    }
    default:
      cached = new UnconfiguredPaymentProvider();
  }

  return cached;
}

export function paymentsConfigured() {
  return paymentProvider().configured;
}
