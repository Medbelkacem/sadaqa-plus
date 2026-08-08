import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { EventStatus, ParticipantKind, Prisma } from '@prisma/client';

import { serverEnv } from '@/config/env';
import { errors } from '@/lib/api/errors';
import { paginate, type Paginated } from '@/lib/api/response';
import { slugify } from '@/lib/utils';
import type { AuthContext } from '@/server/auth/context';
import { prisma } from '@/server/db/prisma';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { recordAudit } from '@/server/services/audit.service';
import { notify } from '@/server/services/notification.service';
import type { CreateEventInput, ListEventsQuery } from '@/validations/event';

/**
 * Event service, including QR attendance.
 *
 * Attendance codes are HMACs over (eventSecret, registrationId). They are
 * verifiable offline by the server without a database lookup on the code
 * itself, cannot be forged without the per-event secret, and are single-use
 * because check-in is guarded by a conditional update.
 */

const PUBLIC_STATUSES: EventStatus[] = ['PUBLISHED', 'ONGOING', 'COMPLETED'];

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  status: true,
  coverId: true,
  startsAt: true,
  endsAt: true,
  venue: true,
  capacity: true,
  volunteerSlots: true,
  publishedAt: true,
  category: { select: { id: true, slug: true, nameFr: true, nameAr: true, nameEn: true, icon: true, color: true } },
  wilaya: { select: { id: true, nameFr: true, nameAr: true, nameEn: true } },
  commune: { select: { id: true, nameFr: true, nameAr: true, nameEn: true } },
  organization: {
    select: { id: true, slug: true, publicName: true, verificationStatus: true, logoId: true, isSadaqaTeam: true },
  },
  _count: { select: { registrations: { where: { status: { in: ['REGISTERED', 'ATTENDED'] } } } } },
} satisfies Prisma.EventSelect;

export type EventCardData = Prisma.EventGetPayload<{ select: typeof cardSelect }>;

export async function listPublicEvents(
  query: Partial<ListEventsQuery> & { page: number; pageSize: number; upcomingOnly?: boolean },
): Promise<Paginated<EventCardData>> {
  const where: Prisma.EventWhereInput = {
    deletedAt: null,
    status: query.status && PUBLIC_STATUSES.includes(query.status)
      ? query.status
      : { in: PUBLIC_STATUSES },
  };

  if (query.upcomingOnly) where.startsAt = { gte: new Date() };
  if (query.wilayaId) where.wilayaId = query.wilayaId;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.organizationId) where.organizationId = query.organizationId;
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: 'insensitive' } },
      { summary: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.event.findMany({
      where,
      select: cardSelect,
      orderBy: query.upcomingOnly ? { startsAt: 'asc' } : { startsAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.event.count({ where }),
  ]);

  return paginate(items, total, query.page, query.pageSize);
}

export async function getPublicEventBySlug(slug: string, viewerId?: string) {
  const event = await prisma.event.findFirst({
    where: { slug, deletedAt: null, status: { in: PUBLIC_STATUSES } },
    select: {
      ...cardSelect,
      description: true,
      requirements: true,
      latitude: true,
      longitude: true,
      reportContent: true,
      reportPublishedAt: true,
      viewCount: true,
      campaign: { select: { id: true, slug: true, title: true } },
    },
  });

  if (!event) return null;

  // The viewer's own registration, and nobody else's.
  const myRegistration = viewerId
    ? await prisma.eventRegistration.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: viewerId } },
        select: { id: true, status: true, kind: true, ticketCode: true, checkedInAt: true },
      })
    : null;

  return {
    ...event,
    myRegistration,
    // Computed here rather than at render time so the page output does not
    // depend on when React happened to run.
    hasStarted: event.startsAt.getTime() < Date.now(),
  };
}

async function uniqueSlug(title: string) {
  const base = slugify(title) || 'evenement';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const exists = await prisma.event.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createEvent(input: CreateEventInput, auth: AuthContext) {
  if (input.organizationId) {
    const membership = auth.organizations.find((o) => o.organizationId === input.organizationId);
    if (!membership) throw errors.forbidden();
    if (membership.verificationStatus !== 'VERIFIED') {
      throw errors.forbidden('Votre association doit être vérifiée pour publier un événement.');
    }
  } else if (!auth.permissions.has(PERMISSIONS.EVENT_MODERATE)) {
    // Events without an organization are Sadaqa+ team events.
    throw errors.forbidden();
  }

  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, kind: 'EVENT', isActive: true },
    select: { id: true },
  });
  if (!category) throw errors.validation('Catégorie invalide.');

  const status: EventStatus = input.saveAsDraft ? 'DRAFT' : 'PENDING_REVIEW';

  const event = await prisma.event.create({
    data: {
      slug: await uniqueSlug(input.title),
      title: input.title,
      summary: input.summary,
      description: input.description,
      categoryId: input.categoryId,
      status,
      organizationId: input.organizationId ?? null,
      campaignId: input.campaignId ?? null,
      createdById: auth.user.id,
      wilayaId: input.wilayaId,
      communeId: input.communeId ?? null,
      venue: input.venue ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity ?? null,
      volunteerSlots: input.volunteerSlots ?? null,
      requirements: input.requirements ?? null,
      coverId: input.coverId ?? null,
      // Per-event secret backing every attendance code.
      attendanceSecret: randomBytes(32).toString('base64url'),
    },
    select: { id: true, slug: true, title: true, status: true },
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'EVENT_CREATED',
    targetType: 'EVENT',
    targetId: event.id,
    metadata: { status },
  });

  return event;
}

const EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ['PENDING_REVIEW', 'ARCHIVED'],
  PENDING_REVIEW: ['PUBLISHED', 'DRAFT', 'CANCELLED', 'ARCHIVED'],
  PUBLISHED: ['ONGOING', 'COMPLETED', 'CANCELLED', 'ARCHIVED'],
  ONGOING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
};

export async function changeEventStatus(id: string, next: EventStatus, auth: AuthContext) {
  const event = await prisma.event.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, organizationId: true, title: true, slug: true },
  });
  if (!event) throw errors.notFound();

  const isModerator = auth.permissions.has(PERMISSIONS.EVENT_MODERATE);
  const isOrgMember =
    event.organizationId != null &&
    auth.organizations.some((o) => o.organizationId === event.organizationId);
  if (!isModerator && !isOrgMember) throw errors.notFound();

  if (next === 'PUBLISHED' && event.status === 'PENDING_REVIEW' && !isModerator) {
    throw errors.forbidden();
  }

  if (!EVENT_TRANSITIONS[event.status]?.includes(next)) {
    throw errors.invalidTransition(event.status, next);
  }

  await prisma.event.update({
    where: { id },
    data: { status: next, ...(next === 'PUBLISHED' ? { publishedAt: new Date() } : {}) },
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'EVENT_STATUS_CHANGED',
    targetType: 'EVENT',
    targetId: id,
    metadata: { from: event.status, to: next },
  });

  // Cancelling an event must reach the people who planned around it.
  if (next === 'CANCELLED') {
    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId: id, status: 'REGISTERED' },
      select: { userId: true },
      take: 1000,
    });
    for (const registration of registrations) {
      await notify({
        userId: registration.userId,
        type: 'EVENT_CANCELLED',
        title: 'Événement annulé',
        body: event.title,
        targetType: 'EVENT',
        targetId: id,
        path: `/events/${event.slug}`,
      }).catch(() => undefined);
    }
  }

  return { status: next };
}

// ---------------------------------------------------------------------------
// Registration & attendance
// ---------------------------------------------------------------------------

/**
 * Attendance code: `<registrationId>.<hmac>`.
 * Short enough for a QR at low error correction, unforgeable without the
 * event secret, and it reveals nothing about the participant.
 */
function ticketMac(registrationId: string, eventSecret: string) {
  return createHmac('sha256', `${serverEnv().AUTH_SECRET}:${eventSecret}`)
    .update(registrationId)
    .digest('base64url')
    .slice(0, 24);
}

function signTicket(registrationId: string, eventSecret: string) {
  return `${registrationId}.${ticketMac(registrationId, eventSecret)}`;
}

function verifyTicket(code: string, eventSecret: string): string | null {
  const separator = code.lastIndexOf('.');
  if (separator <= 0) return null;

  const registrationId = code.slice(0, separator);
  const provided = Buffer.from(code.slice(separator + 1));
  const expected = Buffer.from(ticketMac(registrationId, eventSecret));

  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? registrationId : null;
}

export async function registerForEvent(
  eventId: string,
  auth: AuthContext,
  kind: ParticipantKind = 'PARTICIPANT',
  note?: string,
) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null, status: { in: ['PUBLISHED', 'ONGOING'] } },
    select: {
      id: true,
      title: true,
      slug: true,
      capacity: true,
      startsAt: true,
      venue: true,
      attendanceSecret: true,
    },
  });
  if (!event) throw errors.notFound();
  if (event.startsAt.getTime() < Date.now()) {
    throw errors.conflict('Les inscriptions pour cet événement sont closes.');
  }

  const registration = await prisma.$transaction(async (tx) => {
    // Capacity is checked inside the transaction so two simultaneous
    // registrations cannot both slip past the last free seat.
    if (event.capacity) {
      const taken = await tx.eventRegistration.count({
        where: { eventId, status: { in: ['REGISTERED', 'ATTENDED'] } },
      });
      if (taken >= event.capacity) {
        return tx.eventRegistration.upsert({
          where: { eventId_userId: { eventId, userId: auth.user.id } },
          create: {
            eventId,
            userId: auth.user.id,
            kind,
            status: 'WAITLISTED',
            note: note ?? null,
            ticketCode: `pending-${randomBytes(9).toString('base64url')}`,
          },
          update: { status: 'WAITLISTED', kind, note: note ?? null },
          select: { id: true, status: true, ticketCode: true },
        });
      }
    }

    const created = await tx.eventRegistration.upsert({
      where: { eventId_userId: { eventId, userId: auth.user.id } },
      create: {
        eventId,
        userId: auth.user.id,
        kind,
        status: 'REGISTERED',
        note: note ?? null,
        ticketCode: `pending-${randomBytes(9).toString('base64url')}`,
      },
      update: { status: 'REGISTERED', kind, note: note ?? null },
      select: { id: true, status: true },
    });

    // The signed code needs the row id, so it is written back immediately.
    return tx.eventRegistration.update({
      where: { id: created.id },
      data: { ticketCode: signTicket(created.id, event.attendanceSecret) },
      select: { id: true, status: true, ticketCode: true },
    });
  });

  if (registration.status === 'REGISTERED') {
    await notify({
      userId: auth.user.id,
      type: 'EVENT_REGISTRATION_CONFIRMED',
      title: 'Inscription confirmée',
      body: event.title,
      targetType: 'EVENT',
      targetId: eventId,
      path: `/events/${event.slug}`,
      email: {
        template: 'event_registration',
        vars: {
          eventTitle: event.title,
          date: event.startsAt.toISOString(),
          location: event.venue ?? '',
          ticketCode: registration.ticketCode,
        },
      },
    });
  }

  return registration;
}

export async function cancelRegistration(eventId: string, auth: AuthContext) {
  const result = await prisma.eventRegistration.updateMany({
    where: { eventId, userId: auth.user.id, status: { in: ['REGISTERED', 'WAITLISTED'] } },
    data: { status: 'CANCELLED' },
  });
  if (result.count === 0) throw errors.notFound();
}

/**
 * Records attendance from a scanned code.
 *
 * Returns `alreadyCheckedIn` rather than throwing so the scanner UI can show a
 * calm "already recorded" instead of an error when a volunteer scans twice.
 */
export async function recordAttendance(eventId: string, code: string, auth: AuthContext) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { id: true, organizationId: true, attendanceSecret: true },
  });
  if (!event) throw errors.notFound();

  const isOrgMember =
    event.organizationId != null &&
    auth.organizations.some(
      (o) => o.organizationId === event.organizationId && o.role !== 'MEMBER',
    );
  if (!isOrgMember && !auth.permissions.has(PERMISSIONS.EVENT_ATTENDANCE_RECORD)) {
    throw errors.forbidden();
  }

  const registrationId = verifyTicket(code.trim(), event.attendanceSecret);
  if (!registrationId) throw errors.validation('Code de participation invalide.');

  const registration = await prisma.eventRegistration.findFirst({
    where: { id: registrationId, eventId },
    select: {
      id: true,
      status: true,
      checkedInAt: true,
      user: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!registration) throw errors.validation('Code de participation invalide.');

  if (registration.checkedInAt) {
    return {
      alreadyCheckedIn: true as const,
      participant: registration.user.profile,
      checkedInAt: registration.checkedInAt,
    };
  }

  // Conditional update: only the first scan wins, even under a double tap.
  const claimed = await prisma.eventRegistration.updateMany({
    where: { id: registration.id, checkedInAt: null },
    data: { status: 'ATTENDED', checkedInAt: new Date(), checkedInById: auth.user.id },
  });

  if (claimed.count === 0) {
    return {
      alreadyCheckedIn: true as const,
      participant: registration.user.profile,
      checkedInAt: new Date(),
    };
  }

  await recordAudit({
    actorId: auth.user.id,
    action: 'EVENT_ATTENDANCE_RECORDED',
    targetType: 'EVENT',
    targetId: eventId,
    metadata: { registrationId: registration.id },
  });

  return {
    alreadyCheckedIn: false as const,
    participant: registration.user.profile,
    checkedInAt: new Date(),
  };
}

export async function listEventParticipants(eventId: string, auth: AuthContext) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { id: true, organizationId: true },
  });
  if (!event) throw errors.notFound();

  const isOrgMember =
    event.organizationId != null &&
    auth.organizations.some((o) => o.organizationId === event.organizationId);
  if (!isOrgMember && !auth.permissions.has(PERMISSIONS.EVENT_MODERATE)) {
    throw errors.notFound();
  }

  return prisma.eventRegistration.findMany({
    where: { eventId },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      kind: true,
      status: true,
      checkedInAt: true,
      hoursLogged: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          profile: { select: { firstName: true, lastName: true, avatarId: true } },
        },
      },
    },
    take: 1000,
  });
}

export async function listEventMapMarkers(limit = 300) {
  return prisma.event.findMany({
    where: {
      deletedAt: null,
      status: { in: ['PUBLISHED', 'ONGOING'] },
      latitude: { not: null },
      longitude: { not: null },
      startsAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      startsAt: true,
      latitude: true,
      longitude: true,
      category: { select: { nameFr: true, nameAr: true, nameEn: true, color: true } },
    },
    take: limit,
  });
}
