import type { NextRequest } from 'next/server';

import type { NotificationType } from '@prisma/client';

import { handler, ok } from '@/lib/api/response';
import { readJson } from '@/lib/api/request';
import { requireAuth, requireSameOrigin } from '@/server/auth/guards';
import { prisma } from '@/server/db/prisma';
import { pushConfigured } from '@/server/services/push.service';
import { emailConfigured } from '@/server/services/email/email.service';
import { notificationPreferenceSchema } from '@/validations/messaging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const auth = await requireAuth();

  const preference = await prisma.notificationPreference.findUnique({
    where: { userId: auth.user.id },
  });

  // The UI needs to know which channels the deployment can actually deliver,
  // so it can show "not configured" instead of an inert toggle.
  return ok({
    preference: preference ?? {
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: false,
      urgentNearby: true,
      mutedTypes: [],
    },
    channels: { push: pushConfigured(), email: emailConfigured() },
  });
});

export const PUT = handler(async (request: NextRequest) => {
  await requireSameOrigin();
  const auth = await requireAuth();
  const input = await readJson(request, notificationPreferenceSchema);

  // Enabling push on a deployment without VAPID keys would be a lie.
  const pushEnabled = input.pushEnabled && pushConfigured();

  const preference = await prisma.notificationPreference.upsert({
    where: { userId: auth.user.id },
    create: {
      userId: auth.user.id,
      inAppEnabled: input.inAppEnabled,
      emailEnabled: input.emailEnabled,
      pushEnabled,
      urgentNearby: input.urgentNearby,
      mutedTypes: input.mutedTypes as NotificationType[],
    },
    update: {
      inAppEnabled: input.inAppEnabled,
      emailEnabled: input.emailEnabled,
      pushEnabled,
      urgentNearby: input.urgentNearby,
      mutedTypes: input.mutedTypes as NotificationType[],
    },
  });

  return ok({ preference, pushAvailable: pushConfigured() });
});
