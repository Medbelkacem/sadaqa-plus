import 'server-only';

import type { NotificationType, Prisma, TargetType } from '@prisma/client';

import { serverEnv } from '@/config/env';
import { prisma } from '@/server/db/prisma';

import { sendEmail } from './email/email.service';
import type { TemplateKey, TemplateVars } from './email/templates';
import { sendPushToUser } from './push.service';

/**
 * Notification fan-out.
 *
 * A notification is always persisted in-app first — that is the record of what
 * happened. Email and push are best-effort side channels gated by the user's
 * own preferences; failure in either never rolls back the underlying action.
 *
 * Notifications are only ever emitted from a real domain event. Nothing in
 * this module invents activity.
 */

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  targetType?: TargetType;
  targetId?: string;
  /** Relative path, e.g. `/requests/my-slug`. Made absolute for email/push. */
  path?: string;
  email?: { template: TemplateKey; vars: TemplateVars };
  /** Skip push for low-signal notifications even when the user enabled it. */
  push?: boolean;
  tx?: Prisma.TransactionClient;
};

export async function notify(input: NotifyInput) {
  const client = input.tx ?? prisma;

  await client.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      url: input.path ?? null,
    },
  });

  // Side channels run after the transaction that produced the event, so they
  // are deliberately not awaited inside `tx`.
  if (input.tx) return;

  await deliverSideChannels(input);
}

/**
 * Delivers email/push for a notification already persisted in-app.
 * Exported so callers inside a transaction can fan out after committing.
 */
export async function deliverSideChannels(input: NotifyInput) {
  const [user, preference] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, locale: true, emailVerifiedAt: true, status: true },
    }),
    prisma.notificationPreference.findUnique({ where: { userId: input.userId } }),
  ]);

  if (!user || user.status !== 'ACTIVE') return;

  const muted = preference?.mutedTypes?.includes(input.type) ?? false;
  if (muted) return;

  const appUrl = serverEnv().APP_URL;
  const actionUrl = input.path ? new URL(input.path, appUrl).toString() : undefined;

  const emailEnabled = preference?.emailEnabled ?? true;
  if (input.email && emailEnabled && user.emailVerifiedAt) {
    await sendEmail({
      to: user.email,
      template: input.email.template,
      locale: user.locale,
      vars: { ...input.email.vars, ...(actionUrl ? { actionUrl } : {}) },
    }).catch((error) => console.error('[notify] email fan-out failed', error));
  }

  const pushEnabled = preference?.pushEnabled ?? false;
  if (pushEnabled && input.push !== false) {
    await sendPushToUser(input.userId, {
      title: input.title,
      body: input.body,
      url: input.path,
      tag: `${input.type}:${input.targetId ?? ''}`,
    }).catch((error) => console.error('[notify] push fan-out failed', error));
  }
}

/** Fan-out to several recipients, e.g. every member of an organization. */
export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>) {
  const unique = [...new Set(userIds)];
  for (const userId of unique) {
    await notify({ ...input, userId }).catch((error) =>
      console.error('[notify] failed for user', { userId, error }),
    );
  }
}

/** Every staff member holding a given permission — used for moderation alerts. */
export async function staffUserIdsWithPermission(permissionKey: string) {
  const rows = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      roles: {
        some: {
          role: { permissions: { some: { permission: { key: permissionKey } } } },
        },
      },
    },
    select: { id: true },
    take: 100,
  });
  return rows.map((r) => r.id);
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
