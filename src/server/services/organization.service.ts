import 'server-only';

import type { Prisma, VerificationStatus } from '@prisma/client';

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
import type {
  DecidePartnerApplicationInput,
  PartnerApplicationInput,
} from '@/validations/organization';

/**
 * Organizations and the partnership pipeline.
 *
 * The partner directory only ever lists VERIFIED organizations — an
 * application in flight is invisible to the public. Every verification
 * decision writes an `OrganizationVerification` row naming the reviewer, so a
 * "verified" badge always has a person and a timestamp behind it.
 */

const cardSelect = {
  id: true,
  slug: true,
  publicName: true,
  description: true,
  logoId: true,
  verificationStatus: true,
  verifiedAt: true,
  areasOfWork: true,
  isSadaqaTeam: true,
  wilaya: { select: { id: true, nameFr: true, nameAr: true, nameEn: true } },
  _count: {
    select: {
      campaigns: { where: { status: 'ACTIVE', deletedAt: null } },
      events: { where: { status: 'PUBLISHED', deletedAt: null } },
    },
  },
} satisfies Prisma.OrganizationSelect;

export type OrganizationCardData = Prisma.OrganizationGetPayload<{ select: typeof cardSelect }>;

export async function listVerifiedOrganizations(query: {
  page: number;
  pageSize: number;
  q?: string;
  wilayaId?: number;
}): Promise<Paginated<OrganizationCardData>> {
  const where: Prisma.OrganizationWhereInput = {
    deletedAt: null,
    verificationStatus: 'VERIFIED',
  };

  if (query.wilayaId) where.wilayaId = query.wilayaId;
  if (query.q) {
    where.OR = [
      { publicName: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: cardSelect,
      orderBy: [{ isSadaqaTeam: 'desc' }, { verifiedAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.organization.count({ where }),
  ]);

  return paginate(items, total, query.page, query.pageSize);
}

export async function getPublicOrganizationBySlug(slug: string) {
  return prisma.organization.findFirst({
    where: { slug, deletedAt: null, verificationStatus: 'VERIFIED' },
    select: {
      ...cardSelect,
      website: true,
      facebook: true,
      instagram: true,
      linkedin: true,
      email: true,
      phone: true,
      createdAt: true,
      commune: { select: { id: true, nameFr: true, nameAr: true, nameEn: true } },
      coverage: {
        select: { wilaya: { select: { id: true, nameFr: true, nameAr: true, nameEn: true } } },
      },
      // Legal name and registration number are intentionally absent from the
      // public projection: they are verification inputs, not public content.
    },
  });
}

/** Full record for a member or an administrator. */
export async function getOrganizationForActor(id: string, auth: AuthContext) {
  const isAdmin = auth.permissions.has(PERMISSIONS.ORGANIZATION_VERIFY);
  const membership = auth.organizations.find((o) => o.organizationId === id);
  if (!membership && !isAdmin) throw errors.notFound();

  const organization = await prisma.organization.findFirst({
    where: { id, deletedAt: null },
    include: {
      wilaya: true,
      commune: true,
      members: {
        select: {
          id: true,
          role: true,
          title: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { firstName: true, lastName: true, avatarId: true } },
            },
          },
        },
      },
      verifications: {
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
        },
      },
      application: { select: { id: true, status: true, createdAt: true } },
    },
  });

  if (!organization) throw errors.notFound();
  return { organization, membership, isAdmin };
}

// ---------------------------------------------------------------------------
// Partnership applications
// ---------------------------------------------------------------------------

export async function submitPartnerApplication(
  input: PartnerApplicationInput,
  auth: AuthContext,
) {
  // One live application per account keeps the review queue meaningful.
  const pending = await prisma.partnerApplication.findFirst({
    where: { submittedById: auth.user.id, status: { in: ['PENDING', 'UNDER_REVIEW'] } },
    select: { id: true },
  });
  if (pending) {
    throw errors.conflict('Vous avez déjà une demande de partenariat en cours d’examen.');
  }

  if (input.documentIds?.length) {
    const owned = await prisma.fileAsset.count({
      where: { id: { in: input.documentIds }, uploadedById: auth.user.id, deletedAt: null },
    });
    if (owned !== input.documentIds.length) throw errors.forbidden();
  }

  const application = await prisma.$transaction(async (tx) => {
    const created = await tx.partnerApplication.create({
      data: {
        organizationName: input.organizationName,
        contactPersonName: input.contactPersonName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        wilayaId: input.wilayaId,
        areaOfWork: input.areaOfWork,
        description: input.description,
        website: input.website ?? null,
        socialLinks: input.socialLinks ?? null,
        registrationNumber: input.registrationNumber ?? null,
        submittedById: auth.user.id,
        status: 'PENDING',
      },
      select: { id: true, organizationName: true },
    });

    if (input.documentIds?.length) {
      await tx.partnerApplicationDocument.createMany({
        data: input.documentIds.map((fileId) => ({
          applicationId: created.id,
          fileId,
          label: 'Document justificatif',
        })),
      });
      // Supporting documents stay private, readable only through the
      // authorized file route by a reviewer.
      await tx.fileAsset.updateMany({
        where: { id: { in: input.documentIds } },
        data: { visibility: 'MODERATORS_ONLY' },
      });
    }

    return created;
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'PARTNER_APPLICATION_SUBMITTED',
    targetType: 'ORGANIZATION',
    targetId: application.id,
    metadata: { organizationName: input.organizationName },
  });

  const reviewers = await staffUserIdsWithPermission(PERMISSIONS.PARTNER_APPLICATION_REVIEW);
  await notifyMany(reviewers, {
    type: 'PARTNER_APPLICATION_RECEIVED',
    title: 'Nouvelle demande de partenariat',
    body: application.organizationName,
    targetType: 'ORGANIZATION',
    targetId: application.id,
    path: `/admin/organizations/applications/${application.id}`,
    push: false,
  });

  return application;
}

export async function listPartnerApplications(
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | undefined,
  page: number,
  pageSize: number,
) {
  const where: Prisma.PartnerApplicationWhereInput = status
    ? { status }
    : { status: { in: ['PENDING', 'UNDER_REVIEW'] } };

  const [items, total] = await Promise.all([
    prisma.partnerApplication.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        organizationName: true,
        contactPersonName: true,
        contactEmail: true,
        areaOfWork: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        wilaya: { select: { id: true, nameFr: true, nameAr: true, nameEn: true } },
        _count: { select: { documents: true } },
      },
    }),
    prisma.partnerApplication.count({ where }),
  ]);

  return paginate(items, total, page, pageSize);
}

async function uniqueOrgSlug(name: string) {
  const base = slugify(name) || 'association';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const exists = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Approves or rejects a partnership application.
 *
 * Approval creates the organization, makes the applicant its OWNER, grants
 * them the ORGANIZATION role and records the verification — all in one
 * transaction, so a half-approved partner cannot exist.
 */
export async function decidePartnerApplication(
  applicationId: string,
  input: DecidePartnerApplicationInput,
  auth: AuthContext,
) {
  const application = await prisma.partnerApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      organizationName: true,
      contactEmail: true,
      contactPhone: true,
      description: true,
      wilayaId: true,
      areaOfWork: true,
      website: true,
      registrationNumber: true,
      submittedById: true,
      organizationId: true,
    },
  });
  if (!application) throw errors.notFound();

  if (application.status === 'APPROVED' || application.status === 'REJECTED') {
    throw errors.conflict('Cette demande a déjà été traitée.');
  }

  if (input.decision === 'UNDER_REVIEW') {
    await prisma.partnerApplication.update({
      where: { id: applicationId },
      data: { status: 'UNDER_REVIEW', reviewerId: auth.user.id },
    });
    await recordAudit({
      actorId: auth.user.id,
      action: 'PARTNER_APPLICATION_DECIDED',
      targetType: 'ORGANIZATION',
      targetId: applicationId,
      metadata: { decision: 'UNDER_REVIEW' },
    });
    return { status: 'UNDER_REVIEW' as const };
  }

  if (input.decision === 'REJECTED') {
    await prisma.partnerApplication.update({
      where: { id: applicationId },
      data: {
        status: 'REJECTED',
        reviewerId: auth.user.id,
        reviewedAt: new Date(),
        decisionReason: input.reason,
      },
    });

    await recordAudit({
      actorId: auth.user.id,
      action: 'PARTNER_APPLICATION_DECIDED',
      targetType: 'ORGANIZATION',
      targetId: applicationId,
      metadata: { decision: 'REJECTED', reason: input.reason },
    });

    if (application.submittedById) {
      await notify({
        userId: application.submittedById,
        type: 'ORGANIZATION_REJECTED',
        title: 'Demande de partenariat',
        body: input.reason ?? application.organizationName,
        path: '/dashboard',
        email: {
          template: 'organization_rejected',
          vars: { reason: input.reason ?? '—' },
        },
      });
    }

    return { status: 'REJECTED' as const };
  }

  // --- Approval -----------------------------------------------------------
  const slug = await uniqueOrgSlug(application.organizationName);

  const organization = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        slug,
        legalName: application.organizationName,
        publicName: application.organizationName,
        description: application.description,
        email: application.contactEmail,
        phone: application.contactPhone,
        website: application.website,
        wilayaId: application.wilayaId,
        areasOfWork: [application.areaOfWork],
        registrationNumber: application.registrationNumber,
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
      select: { id: true, slug: true, publicName: true },
    });

    if (application.submittedById) {
      await tx.organizationMember.create({
        data: {
          organizationId: created.id,
          userId: application.submittedById,
          role: 'OWNER',
        },
      });

      const orgRole = await tx.role.findUnique({
        where: { name: 'ORGANIZATION' },
        select: { id: true },
      });
      if (orgRole) {
        await tx.userRole.upsert({
          where: {
            userId_roleId: { userId: application.submittedById, roleId: orgRole.id },
          },
          create: {
            userId: application.submittedById,
            roleId: orgRole.id,
            grantedById: auth.user.id,
          },
          update: {},
        });
      }
    }

    await tx.organizationVerification.create({
      data: {
        organizationId: created.id,
        reviewerId: auth.user.id,
        decision: 'VERIFIED',
        reason: input.reason ?? null,
        evidenceRef: `partner-application:${applicationId}`,
      },
    });

    await tx.partnerApplication.update({
      where: { id: applicationId },
      data: {
        status: 'APPROVED',
        reviewerId: auth.user.id,
        reviewedAt: new Date(),
        decisionReason: input.reason ?? null,
        organizationId: created.id,
      },
    });

    return created;
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'ORGANIZATION_VERIFIED',
    targetType: 'ORGANIZATION',
    targetId: organization.id,
    metadata: { applicationId, slug: organization.slug },
  });

  if (application.submittedById) {
    await notify({
      userId: application.submittedById,
      type: 'ORGANIZATION_VERIFIED',
      title: 'Votre association est vérifiée',
      body: organization.publicName,
      targetType: 'ORGANIZATION',
      targetId: organization.id,
      path: `/organizations/${organization.slug}/manage`,
      email: {
        template: 'organization_approved',
        vars: { organizationName: organization.publicName },
      },
    });
  }

  return { status: 'APPROVED' as const, organization };
}

export async function setOrganizationVerification(
  organizationId: string,
  decision: VerificationStatus,
  reason: string | undefined,
  auth: AuthContext,
) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { id: true, publicName: true, verificationStatus: true },
  });
  if (!organization) throw errors.notFound();

  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: organizationId },
      data: {
        verificationStatus: decision,
        verifiedAt: decision === 'VERIFIED' ? new Date() : null,
      },
    });
    await tx.organizationVerification.create({
      data: {
        organizationId,
        reviewerId: auth.user.id,
        decision,
        reason: reason ?? null,
      },
    });
  });

  await recordAudit({
    actorId: auth.user.id,
    action: decision === 'VERIFIED' ? 'ORGANIZATION_VERIFIED' : 'ORGANIZATION_SUSPENDED',
    targetType: 'ORGANIZATION',
    targetId: organizationId,
    metadata: { from: organization.verificationStatus, to: decision, reason },
  });

  return { verificationStatus: decision };
}
