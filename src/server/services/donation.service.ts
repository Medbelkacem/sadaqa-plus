import 'server-only';

import type { DonationStatus, GoalType, Prisma } from '@prisma/client';

import { errors } from '@/lib/api/errors';
import { paginate } from '@/lib/api/response';
import type { AuthContext } from '@/server/auth/context';
import { humanReference } from '@/server/auth/tokens';
import { prisma } from '@/server/db/prisma';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { recordAudit } from '@/server/services/audit.service';
import { notify, notifyMany } from '@/server/services/notification.service';
import { paymentProvider } from '@/server/payments';

/**
 * Donations.
 *
 * Two distinct concepts, deliberately never merged:
 *
 *   DonationIntent — "I want to help." A declaration of interest. It carries
 *     no money, is never counted in any total, and exists so the platform is
 *     useful before (or without) a payment provider.
 *
 *   Donation — an actual transaction with a lifecycle. It only reaches
 *     CONFIRMED when the configured payment provider says so, via a verified
 *     webhook. There is no code path from a browser click to CONFIRMED.
 */

const DONATION_TRANSITIONS: Record<DonationStatus, DonationStatus[]> = {
  PENDING: ['PROCESSING', 'CANCELLED', 'FAILED'],
  PROCESSING: ['CONFIRMED', 'FAILED', 'CANCELLED'],
  CONFIRMED: ['REFUNDED'],
  FAILED: ['PENDING'],
  REFUNDED: [],
  CANCELLED: [],
};

// ---------------------------------------------------------------------------
// Donation intents
// ---------------------------------------------------------------------------

export async function createDonationIntent(
  input: {
    campaignId?: string;
    requestId?: string;
    kind: GoalType;
    amount?: number;
    quantity?: number;
    unitLabel?: string;
    message?: string;
    contactEmail?: string;
    contactPhone?: string;
  },
  auth: AuthContext,
) {
  if (!input.campaignId && !input.requestId) {
    throw errors.validation('Indiquez une campagne ou une demande.');
  }

  // Verify the target exists and is publicly visible before recording intent.
  if (input.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: input.campaignId, deletedAt: null, status: { in: ['ACTIVE', 'PAUSED'] } },
      select: { id: true, organizationId: true, title: true, slug: true },
    });
    if (!campaign) throw errors.notFound();
  }

  if (input.requestId) {
    const request = await prisma.request.findFirst({
      where: {
        id: input.requestId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'PARTIALLY_HELPED'] },
      },
      select: { id: true, authorId: true, title: true, slug: true },
    });
    if (!request) throw errors.notFound();
  }

  const intent = await prisma.donationIntent.create({
    data: {
      userId: auth.user.id,
      campaignId: input.campaignId ?? null,
      requestId: input.requestId ?? null,
      kind: input.kind,
      amount: input.amount ?? null,
      quantity: input.quantity ?? null,
      unitLabel: input.unitLabel ?? null,
      message: input.message ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      status: 'OPEN',
    },
    select: { id: true },
  });

  // Tell whoever can act on it.
  const recipients: string[] = [];
  if (input.requestId) {
    const request = await prisma.request.findUnique({
      where: { id: input.requestId },
      select: { authorId: true, title: true, slug: true },
    });
    if (request) {
      recipients.push(request.authorId);
      await notifyMany(recipients, {
        type: 'DONATION_INTENT_RECEIVED',
        title: 'Quelqu’un souhaite vous aider',
        body: request.title,
        targetType: 'REQUEST',
        targetId: input.requestId,
        path: `/dashboard/requests`,
      });
    }
  }

  if (input.campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: input.campaignId },
      select: { title: true, organizationId: true },
    });
    if (campaign?.organizationId) {
      const members = await prisma.organizationMember.findMany({
        where: { organizationId: campaign.organizationId },
        select: { userId: true },
      });
      await notifyMany(
        members.map((m) => m.userId),
        {
          type: 'DONATION_INTENT_RECEIVED',
          title: 'Nouvelle intention d’aide',
          body: campaign.title,
          targetType: 'CAMPAIGN',
          targetId: input.campaignId,
          path: `/dashboard`,
          push: false,
        },
      );
    }
  }

  return intent;
}

export async function listIntentsForUser(userId: string, page: number, pageSize: number) {
  const where: Prisma.DonationIntentWhereInput = { userId };
  const [items, total] = await Promise.all([
    prisma.donationIntent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        kind: true,
        amount: true,
        quantity: true,
        unitLabel: true,
        createdAt: true,
        campaign: { select: { slug: true, title: true } },
        request: { select: { slug: true, title: true } },
      },
    }),
    prisma.donationIntent.count({ where }),
  ]);
  return paginate(items, total, page, pageSize);
}

// ---------------------------------------------------------------------------
// Donations
// ---------------------------------------------------------------------------

/**
 * Starts a monetary donation.
 *
 * Throws SERVICE_NOT_CONFIGURED when no payment provider is wired in, which
 * the UI renders as "online payment is not configured yet" — never as a
 * simulated success.
 */
export async function startDonation(
  input: { campaignId: string; amount: number; isAnonymous: boolean },
  auth: AuthContext,
) {
  const provider = paymentProvider();
  if (!provider.configured) throw errors.notConfigured('Le paiement en ligne');

  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, deletedAt: null, status: 'ACTIVE' },
    select: { id: true, currency: true, organizationId: true, title: true },
  });
  if (!campaign) throw errors.notFound();

  const donation = await prisma.$transaction(async (tx) => {
    const created = await tx.donation.create({
      data: {
        reference: humanReference('DN'),
        campaignId: campaign.id,
        organizationId: campaign.organizationId,
        donorId: auth.user.id,
        status: 'PENDING',
        kind: 'MONETARY',
        amount: input.amount,
        currency: campaign.currency,
        isAnonymous: input.isAnonymous,
        provider: provider.name,
      },
      select: { id: true, reference: true, amount: true, currency: true },
    });

    await tx.donationStateEvent.create({
      data: { donationId: created.id, toStatus: 'PENDING' },
    });

    return created;
  });

  const checkout = await provider.createCheckout({
    donationId: donation.id,
    reference: donation.reference,
    amount: input.amount,
    currency: campaign.currency,
    description: campaign.title,
  });

  await prisma.donation.update({
    where: { id: donation.id },
    data: { status: 'PROCESSING', providerRef: checkout.providerRef },
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'DONATION_STATE_CHANGED',
    targetType: 'DONATION',
    targetId: donation.id,
    metadata: { to: 'PROCESSING', provider: provider.name },
  });

  return { donationId: donation.id, redirectUrl: checkout.redirectUrl };
}

/**
 * Applies a state change from a *verified* provider callback.
 *
 * The webhook route verifies the signature before calling this; nothing else
 * in the application is allowed to move a donation to CONFIRMED.
 */
export async function applyProviderState(
  providerRef: string,
  next: DonationStatus,
  reason?: string,
) {
  const donation = await prisma.donation.findFirst({
    where: { providerRef },
    select: {
      id: true,
      status: true,
      donorId: true,
      reference: true,
      amount: true,
      currency: true,
      campaignId: true,
    },
  });
  if (!donation) throw errors.notFound();

  // Idempotency: providers retry webhooks, and a repeat must not double-count.
  if (donation.status === next) return { status: next, changed: false as const };

  if (!DONATION_TRANSITIONS[donation.status]?.includes(next)) {
    throw errors.invalidTransition(donation.status, next);
  }

  await prisma.$transaction(async (tx) => {
    await tx.donation.update({
      where: { id: donation.id },
      data: {
        status: next,
        confirmedAt: next === 'CONFIRMED' ? new Date() : null,
        failureReason: next === 'FAILED' ? (reason ?? null) : null,
      },
    });

    await tx.donationStateEvent.create({
      data: {
        donationId: donation.id,
        fromStatus: donation.status,
        toStatus: next,
        reason: reason ?? null,
      },
    });

    // A receipt only exists for a confirmed transaction.
    if (next === 'CONFIRMED') {
      await tx.donationReceipt.create({
        data: {
          donationId: donation.id,
          receiptNo: humanReference('RC'),
          snapshot: {
            reference: donation.reference,
            amount: donation.amount?.toString() ?? null,
            currency: donation.currency,
            campaignId: donation.campaignId,
            issuedAt: new Date().toISOString(),
            // No tax-deductibility claim is recorded, because none is
            // established. See platform.legal.tax_deductible.
            taxDeductible: false,
          } as Prisma.InputJsonValue,
        },
      });
    }
  });

  await recordAudit({
    action: 'DONATION_STATE_CHANGED',
    targetType: 'DONATION',
    targetId: donation.id,
    metadata: { from: donation.status, to: next, reason },
  });

  if (next === 'CONFIRMED' && donation.donorId) {
    await notify({
      userId: donation.donorId,
      type: 'DONATION_CONFIRMED',
      title: 'Votre don est confirmé',
      body: donation.reference,
      targetType: 'DONATION',
      targetId: donation.id,
      path: '/dashboard/donations',
      email: {
        template: 'donation_confirmed',
        vars: {
          reference: donation.reference,
          amount: `${donation.amount?.toString() ?? ''} ${donation.currency}`,
        },
      },
    });
  }

  return { status: next, changed: true as const };
}

export async function listDonationsForUser(userId: string, page: number, pageSize: number) {
  const where: Prisma.DonationWhereInput = { donorId: userId };
  const [items, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        reference: true,
        status: true,
        amount: true,
        currency: true,
        createdAt: true,
        confirmedAt: true,
        campaign: { select: { slug: true, title: true } },
        receipt: { select: { receiptNo: true, issuedAt: true } },
      },
    }),
    prisma.donation.count({ where }),
  ]);
  return paginate(items, total, page, pageSize);
}

export async function getReceipt(donationId: string, auth: AuthContext) {
  const donation = await prisma.donation.findFirst({
    where: { id: donationId },
    select: {
      id: true,
      donorId: true,
      reference: true,
      amount: true,
      currency: true,
      confirmedAt: true,
      status: true,
      campaign: { select: { title: true } },
      receipt: true,
    },
  });

  // A donation belonging to someone else is indistinguishable from one that
  // does not exist.
  if (!donation) throw errors.notFound();
  if (donation.donorId !== auth.user.id && !auth.permissions.has(PERMISSIONS.DONATION_MANAGE)) {
    throw errors.notFound();
  }
  if (!donation.receipt) throw errors.notFound();

  return donation;
}
