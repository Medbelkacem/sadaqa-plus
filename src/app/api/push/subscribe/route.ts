import type { NextRequest } from 'next/server';

import { handler, noContent, ok } from '@/lib/api/response';
import { errors } from '@/lib/api/errors';
import { readJson } from '@/lib/api/request';
import { requireAuth, requireSameOrigin } from '@/server/auth/guards';
import { prisma } from '@/server/db/prisma';
import { pushConfigured } from '@/server/services/push.service';
import { pushSubscriptionSchema } from '@/validations/messaging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stores a Web Push subscription for the signed-in user.
 *
 * Refuses with SERVICE_NOT_CONFIGURED when no VAPID key pair is set, so the
 * browser is never asked for a permission the server cannot use.
 */
export const POST = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requireAuth();

  if (!pushConfigured()) throw errors.notConfigured('Les notifications push');

  const input = await readJson(request, pushSubscriptionSchema);

  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId: auth.user.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: request.headers.get('user-agent')?.slice(0, 255) ?? null,
    },
    // Re-subscribing on the same endpoint re-points it at the current user;
    // a shared device must not keep delivering to the previous account.
    update: {
      userId: auth.user.id,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
    },
  });

  await prisma.notificationPreference.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, pushEnabled: true },
    update: { pushEnabled: true },
  });

  return ok({ subscribed: true });
});

export const DELETE = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requireAuth();

  const url = new URL(request.url);
  const endpoint = url.searchParams.get('endpoint');

  await prisma.pushSubscription.deleteMany({
    where: { userId: auth.user.id, ...(endpoint ? { endpoint } : {}) },
  });

  await prisma.notificationPreference.updateMany({
    where: { userId: auth.user.id },
    data: { pushEnabled: false },
  });

  return noContent();
});
