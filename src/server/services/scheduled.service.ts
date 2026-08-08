import 'server-only';

import { prisma } from '@/server/db/prisma';
import { getSetting } from '@/server/services/reference.service';
import { notify } from '@/server/services/notification.service';
import { recordAudit } from '@/server/services/audit.service';

/**
 * Scheduled maintenance jobs.
 *
 * Every job operates only on real rows and reports exactly what it touched.
 * None of them fabricate records, and all are idempotent enough to run twice
 * without double-effect.
 */

/** Reminds participants about events starting in the next 24–48 hours. */
export async function sendEventReminders() {
  const now = new Date();
  const from = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const events = await prisma.event.findMany({
    where: { deletedAt: null, status: 'PUBLISHED', startsAt: { gte: from, lt: to } },
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      venue: true,
      registrations: {
        where: { status: 'REGISTERED' },
        select: { userId: true },
      },
    },
  });

  let sent = 0;

  for (const event of events) {
    for (const registration of event.registrations) {
      await notify({
        userId: registration.userId,
        type: 'EVENT_REMINDER',
        title: event.title,
        body: event.venue ?? '',
        targetType: 'EVENT',
        targetId: event.id,
        path: `/events/${event.slug}`,
        email: {
          template: 'event_reminder',
          vars: {
            eventTitle: event.title,
            date: event.startsAt.toISOString(),
            location: event.venue ?? '',
          },
        },
      }).catch(() => undefined);
      sent += 1;
    }
  }

  return { events: events.length, reminders: sent };
}

/**
 * Expires requests that have been public for longer than the configured
 * window without reaching a conclusion.
 */
export async function expireStaleRequests() {
  const days = await getSetting<number>('platform.request.auto_expire_days', 90);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const stale = await prisma.request.findMany({
    where: {
      deletedAt: null,
      status: { in: ['ACTIVE', 'PARTIALLY_HELPED'] },
      publishedAt: { lt: cutoff },
    },
    select: { id: true, authorId: true, title: true, status: true },
    take: 200,
  });

  for (const request of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.request.update({ where: { id: request.id }, data: { status: 'EXPIRED' } });
      await tx.requestStatusEvent.create({
        data: {
          requestId: request.id,
          fromStatus: request.status,
          toStatus: 'EXPIRED',
          note: `Expiration automatique après ${days} jours.`,
        },
      });
    });

    await notify({
      userId: request.authorId,
      type: 'REQUEST_STATUS_CHANGED',
      title: 'Votre demande a expiré',
      body: request.title,
      targetType: 'REQUEST',
      targetId: request.id,
      path: '/dashboard/requests',
      push: false,
    }).catch(() => undefined);
  }

  // Campaigns past their end date close themselves too.
  const closed = await prisma.campaign.updateMany({
    where: { deletedAt: null, status: 'ACTIVE', endDate: { lt: new Date() } },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  // Events whose end time has passed move to COMPLETED.
  const completedEvents = await prisma.event.updateMany({
    where: { deletedAt: null, status: { in: ['PUBLISHED', 'ONGOING'] }, endsAt: { lt: new Date() } },
    data: { status: 'COMPLETED' },
  });

  if (stale.length > 0 || closed.count > 0 || completedEvents.count > 0) {
    await recordAudit({
      action: 'REQUEST_STATUS_CHANGED',
      metadata: {
        job: 'expire',
        requestsExpired: stale.length,
        campaignsCompleted: closed.count,
        eventsCompleted: completedEvents.count,
      },
    });
  }

  return {
    requestsExpired: stale.length,
    campaignsCompleted: closed.count,
    eventsCompleted: completedEvents.count,
  };
}

/**
 * Housekeeping: expired sessions, consumed tokens, old read notifications.
 * Keeps the tables from growing without bound, and shortens the window in
 * which a stale session row could be replayed.
 */
export async function cleanupExpiredRecords() {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [sessions, tokens, notifications, outbox] = await Promise.all([
    prisma.session.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: ninetyDaysAgo } }] },
    }),
    prisma.verificationToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { consumedAt: { lt: ninetyDaysAgo } }] },
    }),
    prisma.notification.deleteMany({
      where: { readAt: { not: null, lt: ninetyDaysAgo } },
    }),
    // Give up on outbox rows that have failed repeatedly; the failure is
    // already recorded in `lastError` for the operator to inspect.
    prisma.outboxMessage.deleteMany({
      where: { sentAt: { not: null, lt: ninetyDaysAgo } },
    }),
  ]);

  return {
    sessions: sessions.count,
    tokens: tokens.count,
    notifications: notifications.count,
    outbox: outbox.count,
  };
}
