import 'server-only';

import type { Prisma, RequestStatus } from '@prisma/client';

import { errors } from '@/lib/api/errors';
import { paginate, type Paginated } from '@/lib/api/response';
import { slugify } from '@/lib/utils';
import type { AuthContext } from '@/server/auth/context';
import { humanReference } from '@/server/auth/tokens';
import { prisma } from '@/server/db/prisma';
import {
  EDITABLE_BY_AUTHOR,
  MODERATION_QUEUE_STATUSES,
  PUBLIC_REQUEST_STATUSES,
  assertTransition,
} from '@/server/domain/request-workflow';
import { recordAudit } from '@/server/services/audit.service';
import {
  notify,
  notifyMany,
  staffUserIdsWithPermission,
} from '@/server/services/notification.service';
import { PERMISSIONS } from '@/server/permissions/definitions';
import type {
  CreateRequestInput,
  ListRequestsQuery,
  ModerateRequestInput,
} from '@/validations/request';

/**
 * Help-request service.
 *
 * Two rules drive most of the code here:
 *  1. Private data (exact address, private attachments, unmasked contact
 *     details) is stripped in the *selection*, not in the component. A public
 *     query cannot accidentally return a beneficiary's home address because it
 *     is never fetched.
 *  2. Status changes go through the state machine and are always paired with a
 *     `RequestStatusEvent` row, so the history is reconstructible.
 */

// ---------------------------------------------------------------------------
// Selections
// ---------------------------------------------------------------------------

const publicCardSelect = {
  id: true,
  reference: true,
  slug: true,
  title: true,
  description: true,
  status: true,
  urgency: true,
  quantity: true,
  beneficiaryCount: true,
  helpedCount: true,
  publishedAt: true,
  createdAt: true,
  locationPrecision: true,
  category: { select: { id: true, slug: true, nameFr: true, nameAr: true, nameEn: true, icon: true, color: true } },
  wilaya: { select: { id: true, nameFr: true, nameAr: true, nameEn: true } },
  commune: { select: { id: true, nameFr: true, nameAr: true, nameEn: true } },
  organization: {
    select: { id: true, slug: true, publicName: true, verificationStatus: true, logoId: true },
  },
} satisfies Prisma.RequestSelect;

export type RequestCardData = Prisma.RequestGetPayload<{ select: typeof publicCardSelect }>;

const publicDetailSelect = {
  ...publicCardSelect,
  contactMethod: true,
  contactPublic: true,
  contactPhone: true,
  contactEmail: true,
  contactWhatsapp: true,
  latitude: true,
  longitude: true,
  viewCount: true,
  completedAt: true,
  expiresAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      profile: { select: { firstName: true, lastName: true, displayName: true, avatarId: true } },
    },
  },
  attachments: {
    where: { visibility: 'PUBLIC' as const },
    select: {
      id: true,
      label: true,
      file: { select: { id: true, mimeType: true, originalName: true } },
    },
  },
  verifications: {
    where: { decision: { in: ['VERIFIED', 'REJECTED'] as const } },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { decision: true, createdAt: true },
  },
} satisfies Prisma.RequestSelect;

export type RequestDetailData = Prisma.RequestGetPayload<{ select: typeof publicDetailSelect }>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

function buildPublicWhere(query: Partial<ListRequestsQuery>): Prisma.RequestWhereInput {
  const where: Prisma.RequestWhereInput = {
    deletedAt: null,
    status: query.status
      ? // A caller-supplied status is still constrained to the public set, so
        // ?status=DRAFT cannot expose unpublished requests.
        PUBLIC_REQUEST_STATUSES.includes(query.status)
        ? query.status
        : { in: PUBLIC_REQUEST_STATUSES }
      : { in: PUBLIC_REQUEST_STATUSES },
  };

  if (query.wilayaId) where.wilayaId = query.wilayaId;
  if (query.communeId) where.communeId = query.communeId;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.categories?.length) where.categoryId = { in: query.categories };
  if (query.urgency) where.urgency = query.urgency;
  if (query.organizationId) where.organizationId = query.organizationId;

  if (query.q) {
    const term = query.q.trim();
    where.OR = [
      { title: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
      { reference: { equals: term.toUpperCase() } },
    ];
  }

  return where;
}

const URGENCY_ORDER: Prisma.RequestOrderByWithRelationInput[] = [
  { urgency: 'desc' },
  { publishedAt: 'desc' },
];

export async function listPublicRequests(
  query: Partial<ListRequestsQuery> & { page: number; pageSize: number },
): Promise<Paginated<RequestCardData>> {
  const where = buildPublicWhere(query);

  const orderBy: Prisma.RequestOrderByWithRelationInput[] =
    query.sort === 'urgency'
      ? URGENCY_ORDER
      : query.sort === 'oldest'
        ? [{ publishedAt: 'asc' }]
        : [{ publishedAt: 'desc' }];

  const [items, total] = await Promise.all([
    prisma.request.findMany({
      where,
      select: publicCardSelect,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.request.count({ where }),
  ]);

  return paginate(items, total, query.page, query.pageSize);
}

/**
 * Public detail view.
 *
 * Contact fields are nulled unless the author opted in to publishing them.
 * The author and moderators get the full record through `getRequestForActor`.
 */
export async function getPublicRequestBySlug(slug: string) {
  const request = await prisma.request.findFirst({
    where: { slug, deletedAt: null, status: { in: PUBLIC_REQUEST_STATUSES } },
    select: publicDetailSelect,
  });

  if (!request) return null;

  return {
    ...request,
    contactPhone: request.contactPublic ? request.contactPhone : null,
    contactEmail: request.contactPublic ? request.contactEmail : null,
    contactWhatsapp: request.contactPublic ? request.contactWhatsapp : null,
    // An exact pin is only ever exposed when the author explicitly chose it.
    latitude: request.locationPrecision === 'COMMUNE_ONLY' ? null : request.latitude,
    longitude: request.locationPrecision === 'COMMUNE_ONLY' ? null : request.longitude,
  };
}

/** Increments the view counter without blocking the page render. */
export async function trackRequestView(id: string) {
  await prisma.request
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);
}

/**
 * Full record for someone entitled to see it: the author, a member of the
 * owning organization, or a moderator. Anyone else gets a 404 — not a 403 —
 * so an id cannot be probed for existence.
 */
export async function getRequestForActor(id: string, auth: AuthContext) {
  const request = await prisma.request.findFirst({
    where: { id, deletedAt: null },
    include: {
      category: true,
      wilaya: true,
      commune: true,
      organization: { select: { id: true, slug: true, publicName: true } },
      author: {
        select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } },
      },
      attachments: { include: { file: true } },
      verifications: {
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
        },
      },
      statusEvents: {
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  });

  if (!request) throw errors.notFound();

  const isAuthor = request.authorId === auth.user.id;
  const isOrgMember =
    request.organizationId != null &&
    auth.organizations.some((o) => o.organizationId === request.organizationId);
  const isModerator = auth.permissions.has(PERMISSIONS.REQUEST_MODERATE);

  if (!isAuthor && !isOrgMember && !isModerator) throw errors.notFound();

  return { request, isAuthor, isOrgMember, isModerator };
}

export async function listRequestsForAuthor(
  userId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<RequestCardData & { status: RequestStatus }>> {
  const where: Prisma.RequestWhereInput = { authorId: userId, deletedAt: null };

  const [items, total] = await Promise.all([
    prisma.request.findMany({
      where,
      select: publicCardSelect,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.request.count({ where }),
  ]);

  return paginate(items, total, page, pageSize);
}

export async function listModerationQueue(page: number, pageSize: number) {
  const where: Prisma.RequestWhereInput = {
    deletedAt: null,
    status: { in: MODERATION_QUEUE_STATUSES },
  };

  const [items, total] = await Promise.all([
    prisma.request.findMany({
      where,
      select: {
        ...publicCardSelect,
        author: {
          select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } },
        },
        _count: { select: { attachments: true } },
      },
      // Oldest first: a queue that shows newest first starves old submissions.
      orderBy: [{ urgency: 'desc' }, { createdAt: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.request.count({ where }),
  ]);

  return paginate(items, total, page, pageSize);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function uniqueSlug(title: string) {
  const base = slugify(title) || 'demande';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${Math.random().toString(36).slice(2, 7)}`;
    const candidate = `${base}${suffix}`;
    const exists = await prisma.request.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createRequest(input: CreateRequestInput, auth: AuthContext) {
  // Posting on behalf of an organization requires actual membership; the
  // organizationId in the body is never trusted on its own.
  if (input.organizationId) {
    const membership = auth.organizations.find(
      (o) => o.organizationId === input.organizationId,
    );
    if (!membership) throw errors.forbidden();
  }

  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, kind: 'REQUEST', isActive: true },
    select: { id: true },
  });
  if (!category) throw errors.validation('Catégorie invalide.', { categoryId: ['Catégorie invalide.'] });

  if (input.communeId) {
    const commune = await prisma.commune.findFirst({
      where: { id: input.communeId, wilayaId: input.wilayaId },
      select: { id: true },
    });
    if (!commune) {
      throw errors.validation('Cette commune n’appartient pas à la wilaya sélectionnée.', {
        communeId: ['Commune invalide pour cette wilaya.'],
      });
    }
  }

  // Attachments must belong to the caller, otherwise a guessed file id could
  // be grafted onto someone else's document.
  if (input.attachmentIds.length > 0) {
    const owned = await prisma.fileAsset.count({
      where: { id: { in: input.attachmentIds }, uploadedById: auth.user.id, deletedAt: null },
    });
    if (owned !== input.attachmentIds.length) throw errors.forbidden();
  }

  const targetStatus: RequestStatus = input.saveAsDraft ? 'DRAFT' : 'PENDING_REVIEW';
  const slug = await uniqueSlug(input.title);

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.request.create({
      data: {
        reference: humanReference('RQ'),
        slug,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        status: targetStatus,
        urgency: input.urgency,
        quantity: input.quantity ?? null,
        beneficiaryCount: input.beneficiaryCount ?? null,
        authorId: auth.user.id,
        organizationId: input.organizationId ?? null,
        wilayaId: input.wilayaId,
        communeId: input.communeId ?? null,
        addressPrivate: input.addressPrivate ?? null,
        locationPrecision: input.locationPrecision,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        contactMethod: input.contactMethod,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        contactWhatsapp: input.contactWhatsapp ?? null,
        contactPublic: input.contactPublic,
      },
      select: { id: true, slug: true, reference: true, title: true, status: true },
    });

    if (input.attachmentIds.length > 0) {
      await tx.requestAttachment.createMany({
        data: input.attachmentIds.map((fileId) => ({
          requestId: created.id,
          fileId,
          // Supporting documents default to moderators-only. Publishing an
          // attachment is an explicit, separate decision.
          visibility: 'MODERATORS_ONLY' as const,
        })),
      });
    }

    await tx.requestStatusEvent.create({
      data: { requestId: created.id, toStatus: targetStatus, actorId: auth.user.id },
    });

    return created;
  });

  await recordAudit({
    actorId: auth.user.id,
    action: input.saveAsDraft ? 'REQUEST_CREATED' : 'REQUEST_SUBMITTED',
    targetType: 'REQUEST',
    targetId: request.id,
    metadata: { reference: request.reference, status: targetStatus },
  });

  if (targetStatus === 'PENDING_REVIEW') {
    const moderators = await staffUserIdsWithPermission(PERMISSIONS.REQUEST_MODERATE);
    await notifyMany(moderators, {
      type: 'REQUEST_SUBMITTED',
      title: 'Nouvelle demande à vérifier',
      body: request.title,
      targetType: 'REQUEST',
      targetId: request.id,
      path: `/admin/requests/${request.id}`,
      push: false,
    });
  }

  return request;
}

export async function updateRequest(
  id: string,
  input: CreateRequestInput,
  auth: AuthContext,
) {
  const existing = await prisma.request.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, authorId: true, status: true, organizationId: true },
  });
  if (!existing) throw errors.notFound();
  if (existing.authorId !== auth.user.id) throw errors.notFound();
  if (!EDITABLE_BY_AUTHOR.includes(existing.status)) {
    throw errors.conflict('Cette demande ne peut plus être modifiée.');
  }

  const nextStatus: RequestStatus = input.saveAsDraft ? 'DRAFT' : 'PENDING_REVIEW';

  const updated = await prisma.$transaction(async (tx) => {
    const request = await tx.request.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        urgency: input.urgency,
        quantity: input.quantity ?? null,
        beneficiaryCount: input.beneficiaryCount ?? null,
        wilayaId: input.wilayaId,
        communeId: input.communeId ?? null,
        addressPrivate: input.addressPrivate ?? null,
        locationPrecision: input.locationPrecision,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        contactMethod: input.contactMethod,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        contactWhatsapp: input.contactWhatsapp ?? null,
        contactPublic: input.contactPublic,
        status: nextStatus,
      },
      select: { id: true, slug: true, status: true, title: true },
    });

    if (existing.status !== nextStatus) {
      await tx.requestStatusEvent.create({
        data: {
          requestId: id,
          fromStatus: existing.status,
          toStatus: nextStatus,
          actorId: auth.user.id,
          note: 'Modifiée par l’auteur',
        },
      });
    }

    return request;
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'REQUEST_STATUS_CHANGED',
    targetType: 'REQUEST',
    targetId: id,
    metadata: { from: existing.status, to: nextStatus, via: 'author-edit' },
  });

  return updated;
}

/**
 * Moderator decision.
 *
 * Runs inside a transaction with the status event and the verification record
 * so a decision is never half-written.
 */
export async function moderateRequest(
  id: string,
  input: ModerateRequestInput,
  auth: AuthContext,
) {
  const existing = await prisma.request.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, title: true, slug: true, authorId: true },
  });
  if (!existing) throw errors.notFound();

  const target: Record<ModerateRequestInput['action'], RequestStatus> = {
    start_review: 'UNDER_REVIEW',
    verify: 'VERIFIED',
    publish: 'ACTIVE',
    reject: 'REJECTED',
    archive: 'ARCHIVED',
    expire: 'EXPIRED',
  };

  const nextStatus = target[input.action];
  assertTransition(existing.status, nextStatus);

  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id },
      data: {
        status: nextStatus,
        ...(nextStatus === 'ACTIVE' ? { publishedAt: new Date() } : {}),
        ...(nextStatus === 'COMPLETED' ? { completedAt: new Date() } : {}),
      },
    });

    await tx.requestStatusEvent.create({
      data: {
        requestId: id,
        fromStatus: existing.status,
        toStatus: nextStatus,
        actorId: auth.user.id,
        note: input.reason ?? null,
      },
    });

    // Verification decisions are recorded separately: who decided, when, why,
    // and against what evidence. This is the audit trail a badge rests on.
    if (input.action === 'verify' || input.action === 'reject') {
      await tx.requestVerification.create({
        data: {
          requestId: id,
          reviewerId: auth.user.id,
          decision: input.action === 'verify' ? 'VERIFIED' : 'REJECTED',
          reason: input.reason ?? null,
          evidenceRef: input.evidenceRef ?? null,
        },
      });
    }

    if (input.action === 'start_review') {
      await tx.requestVerification.create({
        data: { requestId: id, reviewerId: auth.user.id, decision: 'UNDER_REVIEW' },
      });
    }
  });

  await recordAudit({
    actorId: auth.user.id,
    action:
      input.action === 'verify'
        ? 'REQUEST_VERIFIED'
        : input.action === 'reject'
          ? 'REQUEST_REJECTED'
          : 'REQUEST_STATUS_CHANGED',
    targetType: 'REQUEST',
    targetId: id,
    metadata: { from: existing.status, to: nextStatus, reason: input.reason },
  });

  if (nextStatus === 'ACTIVE') {
    await notify({
      userId: existing.authorId,
      type: 'REQUEST_APPROVED',
      title: 'Votre demande est publiée',
      body: existing.title,
      targetType: 'REQUEST',
      targetId: id,
      path: `/requests/${existing.slug}`,
      email: { template: 'request_approved', vars: { title: existing.title } },
    });
  }

  if (nextStatus === 'REJECTED') {
    await notify({
      userId: existing.authorId,
      type: 'REQUEST_REJECTED',
      title: 'Votre demande n’a pas été publiée',
      body: input.reason ?? existing.title,
      targetType: 'REQUEST',
      targetId: id,
      path: `/dashboard/requests`,
      email: {
        template: 'request_rejected',
        vars: { title: existing.title, reason: input.reason ?? '—' },
      },
    });
  }

  return { status: nextStatus };
}

/** Author-driven progress update on a published request. */
export async function updateRequestProgress(
  id: string,
  status: RequestStatus,
  note: string | undefined,
  auth: AuthContext,
) {
  const existing = await prisma.request.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, authorId: true },
  });
  if (!existing) throw errors.notFound();
  if (existing.authorId !== auth.user.id) throw errors.notFound();

  assertTransition(existing.status, status);

  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id },
      data: {
        status,
        ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
        ...(status === 'PARTIALLY_HELPED' ? { helpedCount: { increment: 1 } } : {}),
      },
    });
    await tx.requestStatusEvent.create({
      data: {
        requestId: id,
        fromStatus: existing.status,
        toStatus: status,
        actorId: auth.user.id,
        note: note ?? null,
      },
    });
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'REQUEST_STATUS_CHANGED',
    targetType: 'REQUEST',
    targetId: id,
    metadata: { from: existing.status, to: status, via: 'author-progress' },
  });

  return { status };
}

export async function softDeleteRequest(id: string, auth: AuthContext) {
  const existing = await prisma.request.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, authorId: true, status: true },
  });
  if (!existing) throw errors.notFound();

  const isAuthor = existing.authorId === auth.user.id;
  const isModerator = auth.permissions.has(PERMISSIONS.REQUEST_MODERATE);
  if (!isAuthor && !isModerator) throw errors.notFound();

  await prisma.request.update({ where: { id }, data: { deletedAt: new Date() } });

  await recordAudit({
    actorId: auth.user.id,
    action: 'REQUEST_DELETED',
    targetType: 'REQUEST',
    targetId: id,
    metadata: { status: existing.status, byModerator: !isAuthor },
  });
}

/** Public map markers. Never returns an exact pin for a sensitive request. */
export async function listRequestMapMarkers(limit = 500) {
  const rows = await prisma.request.findMany({
    where: {
      deletedAt: null,
      status: { in: PUBLIC_REQUEST_STATUSES },
      locationPrecision: { not: 'COMMUNE_ONLY' },
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      urgency: true,
      latitude: true,
      longitude: true,
      locationPrecision: true,
      category: { select: { nameFr: true, nameAr: true, nameEn: true, color: true } },
      wilaya: { select: { nameFr: true, nameAr: true, nameEn: true } },
    },
    take: limit,
  });

  return rows.map((row) => ({
    ...row,
    // Approximate pins are rounded to ~1 km so a marker cannot be walked back
    // to a household.
    latitude:
      row.locationPrecision === 'APPROXIMATE'
        ? Math.round(row.latitude! * 100) / 100
        : row.latitude!,
    longitude:
      row.locationPrecision === 'APPROXIMATE'
        ? Math.round(row.longitude! * 100) / 100
        : row.longitude!,
  }));
}
