import 'server-only';

import webpush from 'web-push';

import { serverEnv } from '@/config/env';
import { prisma } from '@/server/db/prisma';

/**
 * Web Push delivery.
 *
 * Disabled — and reported as disabled — until a VAPID key pair is configured.
 * Generate one with `npm run push:keys`.
 */

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;

  const env = serverEnv();
  if (!env.PUSH_PUBLIC_KEY || !env.PUSH_PRIVATE_KEY) {
    configured = false;
    return false;
  }

  webpush.setVapidDetails(env.PUSH_SUBJECT, env.PUSH_PUBLIC_KEY, env.PUSH_PRIVATE_KEY);
  configured = true;
  return true;
}

export function pushConfigured() {
  return ensureConfigured();
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!ensureConfigured()) return { sent: 0, configured: false };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (subscriptions.length === 0) return { sent: 0, configured: true };

  const body = JSON.stringify(payload);
  let sent = 0;
  const expired: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60 * 24 },
        );
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        // 404/410 mean the browser dropped the subscription — prune it.
        if (statusCode === 404 || statusCode === 410) {
          expired.push(sub.id);
        } else {
          console.error('[push] delivery failed', { statusCode });
        }
      }
    }),
  );

  if (expired.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: expired } } });
  }

  if (sent > 0) {
    await prisma.pushSubscription.updateMany({
      where: { userId, id: { notIn: expired } },
      data: { lastUsedAt: new Date() },
    });
  }

  return { sent, configured: true };
}
