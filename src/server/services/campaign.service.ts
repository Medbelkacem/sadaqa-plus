import 'server-only';

import type { CampaignStatus, Prisma } from '@prisma/client';

import { errors } from '@/lib/api/errors';
import { paginate, type Paginated } from '@/lib/api/response';
import { slugify } from '@/lib/utils';
import type { AuthContext } from '@/server/auth/context';
import { prisma } from '@/server/db/prisma';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { recordAudit } from '@/server/services/audit.service';
import {
  notify,
  notifyMany,
  staffUserIdsWithPermission,
} from '@/server/services/notification.service';
import type { CreateCampaignInput, ListCampaignsQuery } from '@/validations/campaign';

/**
 * Campaign service.
 *
 * Progress is never stored as a percentage. It is derived at read time from
 * confirmed donations (monetary) or confirmed material contributions, so a
 * displayed bar always matches what is actually in the ledger.
 */

const PUBLIC_STATUSES: CampaignStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED'];

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  status: true,
  goalType: true,
  targetAmount: true,
  targetQuantity: true,
  unitLabel: true,
  currency: true,
  coverId: true,
  startDate: true,
  endDate: true,
  publishedAt: true,
  category: { select: { id: true, slug: true, nameFr: true, nameAr: true, nameEn: true, icon: true, color: true } },
  wilaya: { select: { id: true, nameFr: true, nameAr: true, nameEn: true } },
  commune: { select: { id: true, nameFr: true, nameAr: true, nameEn: true } },
  organization: {
    select: { id: true, slug: true, publicName: true, verificationStatus: true, logoId: true, isSadaqaTeam: true },
  },
} satisfies Prisma.CampaignSelect;

type CampaignRow = Prisma.CampaignGetPayload<{ select: typeof cardSelect }>;

export type CampaignProgress = {
  /** Confirmed monetary total, in the campaign currency. */
  raisedAmount: number;
  /** Confirmed material units. */
  raisedQuantity: number;
  /** Integer percentage, or null when the campaign has no numeric target. */
  percent: number | null;
  donorCount: number;
};

export type CampaignCardData = CampaignRow & { progress: CampaignProgress };

/**
 * Computes progress for a set of campaigns in two grouped queries rather than
 * one query per campaign.
 */
async function progressFor(campaigns: CampaignRow[]): Promise<Map<string, CampaignProgress>> {
  const ids = campaigns.map((c) => c.id);
  const result = new Map<string, CampaignProgress>();
  if (ids.length === 0) return result;

  const grouped = await prisma.donation.groupBy({
    by: ['campaignId'],
    where: { campaignId: { in: ids }, status: 'CONFIRMED' },
    _sum: { amount: true, quantity: true },
    _count: { _all: true },
  });

  const byId = new Map(grouped.map((row) => [row.campaignId!, row]));

  for (const campaign of campaigns) {
    const row = byId.get(campaign.id);
    const raisedAmount = Number(row?._sum.amount ?? 0);
    const raisedQuantity = Number(row?._sum.quantity ?? 0);

    let percent: number | null = null;
    if (campaign.goalType === 'MONETARY' && campaign.targetAmount) {
      const target = Number(campaign.targetAmount);
      percent = target > 0 ? Math.min(100, Math.round((raisedAmount / target) * 100)) : null;
    } else if (campaign.goalType === 'MATERIAL' && campaign.targetQuantity) {
      const target = campaign.targetQuantity;
      percent = target > 0 ? Math.min(100, Math.round((raisedQuantity / target) * 100)) : null;
    }

    result.set(campaign.id, {
      raisedAmount,
      raisedQuantity,
      percent,
      donorCount: row?._count._all ?? 0,
    });
  }

  return result;
}

export async function listPublicCampaigns(
  query: Partial<ListCampaignsQuery> & { page: number; pageSize: number },
): Promise<Paginated<CampaignCardData>> {
  const where: Prisma.CampaignWhereInput = {
    deletedAt: null,
    status: query.status && PUBLIC_STATUSES.includes(query.status)
      ? query.status
      : { in: PUBLIC_STATUSES },
  };

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
    prisma.campaign.findMany({
      where,
      select: cardSelect,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.campaign.count({ where }),
  ]);

  const progress = await progressFor(items);

  return paginate(
    items.map((item) => ({
      ...item,
      progress: progress.get(item.id) ?? {
        raisedAmount: 0,
        raisedQuantity: 0,
        percent: null,
        donorCount: 0,
      },
    })),
    total,
    query.page,
    query.pageSize,
  );
}

export async function getPublicCampaignBySlug(slug: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { slug, deletedAt: null, status: { in: PUBLIC_STATUSES } },
    select: {
      ...cardSelect,
      description: true,
      viewCount: true,
      completedAt: true,
      media: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, caption: true, fileId: true },
      },
      updates: {
        orderBy: { publishedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          content: true,
          publishedAt: true,
          author: { select: { profile: { select: { firstName: true, lastName: true } } } },
          media: { select: { id: true, fileId: true, caption: true } },
        },
      },
    },
  });

  if (!campaign) return null;

  const progress = (await progressFor([campaign as CampaignRow])).get(campaign.id)!;
  return { ...campaign, progress };
}

export async function listCampaignsForOrganization(
  organizationId: string,
  page: number,
  pageSize: number,
) {
  const where: Prisma.CampaignWhereInput = { organizationId, deletedAt: null };

  const [items, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      select: cardSelect,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.campaign.count({ where }),
  ]);

  const progress = await progressFor(items);
  return paginate(
    items.map((item) => ({
      ...item,
      progress: progress.get(item.id) ?? {
        raisedAmount: 0,
        raisedQuantity: 0,
        percent: null,
        donorCount: 0,
      },
    })),
    total,
    page,
    pageSize,
  );
}

async function uniqueSlug(title: string) {
  const base = slugify(title) || 'campagne';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const exists = await prisma.campaign.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createCampaign(input: CreateCampaignInput, auth: AuthContext) {
  const membership = auth.organizations.find((o) => o.organizationId === input.organizationId);
  if (!membership) throw errors.forbidden();

  // Only a verified organization can publish. An unverified one may draft.
  if (membership.verificationStatus !== 'VERIFIED') {
    throw errors.forbidden(
      'Votre association doit être vérifiée avant de pouvoir créer une campagne.',
    );
  }

  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, kind: 'CAMPAIGN', isActive: true },
    select: { id: true },
  });
  if (!category) throw errors.validation('Catégorie invalide.');

  const status: CampaignStatus = input.saveAsDraft ? 'DRAFT' : 'PENDING_REVIEW';
  const slug = await uniqueSlug(input.title);

  const campaign = await prisma.campaign.create({
    data: {
      slug,
      title: input.title,
      summary: input.summary,
      description: input.description,
      categoryId: input.categoryId,
      status,
      goalType: input.goalType,
      targetAmount: input.targetAmount ?? null,
      targetQuantity: input.targetQuantity ?? null,
      unitLabel: input.unitLabel ?? null,
      organizationId: input.organizationId,
      createdById: auth.user.id,
      wilayaId: input.wilayaId ?? null,
      communeId: input.communeId ?? null,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      coverId: input.coverId ?? null,
    },
    select: { id: true, slug: true, title: true, status: true },
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'CAMPAIGN_CREATED',
    targetType: 'CAMPAIGN',
    targetId: campaign.id,
    metadata: { status, organizationId: input.organizationId },
  });

  if (status === 'PENDING_REVIEW') {
    const moderators = await staffUserIdsWithPermission(PERMISSIONS.CAMPAIGN_MODERATE);
    await notifyMany(moderators, {
      type: 'REQUEST_SUBMITTED',
      title: 'Nouvelle campagne à valider',
      body: campaign.title,
      targetType: 'CAMPAIGN',
      targetId: campaign.id,
      path: `/admin/campaigns/${campaign.id}`,
      push: false,
    });
  }

  return campaign;
}

const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ['PENDING_REVIEW', 'ARCHIVED'],
  PENDING_REVIEW: ['ACTIVE', 'DRAFT', 'CANCELLED', 'ARCHIVED'],
  ACTIVE: ['PAUSED', 'COMPLETED', 'CANCELLED', 'ARCHIVED'],
  PAUSED: ['ACTIVE', 'CANCELLED', 'COMPLETED', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
};

export async function changeCampaignStatus(
  id: string,
  next: CampaignStatus,
  auth: AuthContext,
  reason?: string,
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, organizationId: true, title: true, createdById: true, slug: true },
  });
  if (!campaign) throw errors.notFound();

  const isModerator = auth.permissions.has(PERMISSIONS.CAMPAIGN_MODERATE);
  const isOrgMember =
    campaign.organizationId != null &&
    auth.organizations.some((o) => o.organizationId === campaign.organizationId);

  if (!isModerator && !isOrgMember) throw errors.notFound();

  // Publication is a moderation decision; an organization cannot self-approve.
  if (next === 'ACTIVE' && campaign.status === 'PENDING_REVIEW' && !isModerator) {
    throw errors.forbidden();
  }

  if (!CAMPAIGN_TRANSITIONS[campaign.status]?.includes(next)) {
    throw errors.invalidTransition(campaign.status, next);
  }

  await prisma.campaign.update({
    where: { id },
    data: {
      status: next,
      ...(next === 'ACTIVE' && !campaign.status.includes('ACTIVE') ? { publishedAt: new Date() } : {}),
      ...(next === 'COMPLETED' ? { completedAt: new Date() } : {}),
    },
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'CAMPAIGN_STATUS_CHANGED',
    targetType: 'CAMPAIGN',
    targetId: id,
    metadata: { from: campaign.status, to: next, reason },
  });

  if (next === 'ACTIVE') {
    await notify({
      userId: campaign.createdById,
      type: 'CAMPAIGN_APPROVED',
      title: 'Votre campagne est publiée',
      body: campaign.title,
      targetType: 'CAMPAIGN',
      targetId: id,
      path: `/campaigns/${campaign.slug}`,
    });
  }

  return { status: next };
}

/** Publishes a real update authored by the organization. */
export async function publishCampaignUpdate(
  campaignId: string,
  input: { title: string; content: string; mediaIds?: string[] },
  auth: AuthContext,
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, deletedAt: null },
    select: { id: true, organizationId: true, title: true, slug: true },
  });
  if (!campaign) throw errors.notFound();

  const isOrgMember =
    campaign.organizationId != null &&
    auth.organizations.some((o) => o.organizationId === campaign.organizationId);
  if (!isOrgMember && !auth.permissions.has(PERMISSIONS.CAMPAIGN_MODERATE)) {
    throw errors.notFound();
  }

  const update = await prisma.$transaction(async (tx) => {
    const created = await tx.campaignUpdate.create({
      data: {
        campaignId,
        authorId: auth.user.id,
        title: input.title,
        content: input.content,
      },
      select: { id: true, title: true },
    });

    if (input.mediaIds?.length) {
      await tx.campaignUpdateMedia.createMany({
        data: input.mediaIds.map((fileId) => ({ updateId: created.id, fileId })),
      });
    }

    return created;
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'CAMPAIGN_UPDATED',
    targetType: 'CAMPAIGN',
    targetId: campaignId,
    metadata: { updateId: update.id },
  });

  // Everyone who saved this campaign gets told — and only them.
  const followers = await prisma.savedItem.findMany({
    where: { targetType: 'CAMPAIGN', targetId: campaignId },
    select: { userId: true },
    take: 500,
  });

  await notifyMany(
    followers.map((f) => f.userId),
    {
      type: 'CAMPAIGN_UPDATE',
      title: campaign.title,
      body: update.title,
      targetType: 'CAMPAIGN',
      targetId: campaignId,
      path: `/campaigns/${campaign.slug}`,
      email: {
        template: 'campaign_update',
        vars: {
          campaignTitle: campaign.title,
          updateTitle: input.title,
          excerpt: input.content.slice(0, 220),
        },
      },
    },
  );

  return update;
}

export async function listCampaignMapMarkers(limit = 300) {
  return prisma.campaign.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      latitude: true,
      longitude: true,
      category: { select: { nameFr: true, nameAr: true, nameEn: true, color: true } },
    },
    take: limit,
  });
}
