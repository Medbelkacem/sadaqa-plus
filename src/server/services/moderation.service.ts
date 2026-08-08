import 'server-only';

import type { Prisma, ReportReason, ReportStatus, TargetType } from '@prisma/client';

import { errors } from '@/lib/api/errors';
import { paginate } from '@/lib/api/response';
import type { AuthContext } from '@/server/auth/context';
import { prisma } from '@/server/db/prisma';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { recordAudit } from '@/server/services/audit.service';
import {
  notify,
  notifyMany,
  staffUserIdsWithPermission,
} from '@/server/services/notification.service';

/**
 * Reports and moderation decisions.
 *
 * A report never changes the state of what it targets. Content is not hidden,
 * flagged as fraudulent, or auto-removed because someone reported it — it is
 * queued for a human, who records an explicit decision. Automated
 * "fraud" labelling of a person asking for help is exactly the failure mode
 * this design refuses.
 */

export async function createReport(
  input: {
    targetType: TargetType;
    targetId: string;
    reason: ReportReason;
    description?: string;
  },
  auth: AuthContext,
) {
  // Reporting the same thing twice adds noise without adding signal.
  const existing = await prisma.report.findFirst({
    where: {
      reporterId: auth.user.id,
      targetType: input.targetType,
      targetId: input.targetId,
      status: { in: ['OPEN', 'UNDER_REVIEW'] },
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, duplicate: true as const };

  const report = await prisma.report.create({
    data: {
      reporterId: auth.user.id,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      description: input.description ?? null,
      status: 'OPEN',
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'REPORT_CREATED',
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: { reason: input.reason, reportId: report.id },
  });

  const moderators = await staffUserIdsWithPermission(PERMISSIONS.REPORT_MODERATE);
  await notifyMany(moderators, {
    type: 'REPORT_DECISION',
    title: 'Nouveau signalement',
    body: `${input.targetType} · ${input.reason}`,
    targetType: input.targetType,
    targetId: input.targetId,
    path: `/admin/reports/${report.id}`,
    push: false,
  });

  return { id: report.id, duplicate: false as const };
}

export async function listReports(
  status: ReportStatus | undefined,
  page: number,
  pageSize: number,
) {
  const where: Prisma.ReportWhereInput = status
    ? { status }
    : { status: { in: ['OPEN', 'UNDER_REVIEW'] } };

  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        description: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        resolution: true,
        reporter: {
          select: { id: true, profile: { select: { firstName: true, lastName: true } } },
        },
        moderator: {
          select: { id: true, profile: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
    prisma.report.count({ where }),
  ]);

  return paginate(items, total, page, pageSize);
}

export async function resolveReport(
  id: string,
  input: { status: 'UNDER_REVIEW' | 'ACTION_TAKEN' | 'DISMISSED'; resolution?: string },
  auth: AuthContext,
) {
  const report = await prisma.report.findUnique({
    where: { id },
    select: { id: true, status: true, reporterId: true, targetType: true, targetId: true },
  });
  if (!report) throw errors.notFound();
  if (report.status === 'ACTION_TAKEN' || report.status === 'DISMISSED') {
    throw errors.conflict('Ce signalement a déjà été traité.');
  }

  await prisma.report.update({
    where: { id },
    data: {
      status: input.status,
      moderatorId: auth.user.id,
      resolution: input.resolution ?? null,
      resolvedAt: input.status === 'UNDER_REVIEW' ? null : new Date(),
    },
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'REPORT_DECIDED',
    targetType: report.targetType,
    targetId: report.targetId,
    metadata: { reportId: id, status: input.status, resolution: input.resolution },
  });

  // Closing the loop with the reporter is what keeps people reporting.
  if (report.reporterId && input.status !== 'UNDER_REVIEW') {
    await notify({
      userId: report.reporterId,
      type: 'REPORT_DECISION',
      title: 'Votre signalement a été traité',
      body: input.resolution ?? '',
      path: '/notifications',
      push: false,
    });
  }

  return { status: input.status };
}

/**
 * Signals that warrant a human look. Deliberately *not* a fraud score: the
 * output is a list of things to check, and the label used everywhere in the UI
 * is "needs review", never "fraudulent".
 */
export async function duplicateSignalsForRequest(requestId: string) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, title: true, authorId: true, wilayaId: true, categoryId: true },
  });
  if (!request) return [];

  const candidates = await prisma.request.findMany({
    where: {
      id: { not: requestId },
      deletedAt: null,
      OR: [
        { authorId: request.authorId },
        { AND: [{ wilayaId: request.wilayaId }, { categoryId: request.categoryId }] },
      ],
      status: { in: ['PENDING_REVIEW', 'UNDER_REVIEW', 'ACTIVE', 'VERIFIED'] },
    },
    select: { id: true, reference: true, title: true, status: true, authorId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return candidates.map((candidate) => ({
    ...candidate,
    sameAuthor: candidate.authorId === request.authorId,
    titleSimilarity: similarity(candidate.title, request.title),
  }));
}

/** Cheap token-overlap ratio. Good enough to surface obvious re-posts. */
function similarity(a: string, b: string) {
  const tokenize = (value: string) =>
    new Set(
      value
        .toLowerCase()
        .split(/\W+/u)
        .filter((token) => token.length > 3),
    );
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;
  return Math.round((shared / Math.min(setA.size, setB.size)) * 100);
}
