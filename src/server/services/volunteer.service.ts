import 'server-only';

import type { MissionStatus, Prisma } from '@prisma/client';

import { errors } from '@/lib/api/errors';
import { paginate, type Paginated } from '@/lib/api/response';
import { slugify } from '@/lib/utils';
import type { AuthContext } from '@/server/auth/context';
import { prisma } from '@/server/db/prisma';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { recordAudit } from '@/server/services/audit.service';
import { notify, notifyMany } from '@/server/services/notification.service';
import type { CreateMissionInput, VolunteerProfileInput } from '@/validations/volunteer';

/**
 * Volunteering.
 *
 * A volunteer profile stores what an organisation needs to match someone to a
 * mission — skills, languages, availability, wilaya — and nothing more. There
 * is no field for age, gender, health or family status, because no mission
 * assignment needs them and collecting them would create risk for no benefit.
 */

const missionCardSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  status: true,
  volunteersNeeded: true,
  volunteersAccepted: true,
  startsAt: true,
  endsAt: true,
  venue: true,
  requirements: true,
  publishedAt: true,
  category: { select: { id: true, slug: true, nameFr: true, nameAr: true, nameEn: true, icon: true, color: true } },
  wilaya: { select: { id: true, nameFr: true, nameAr: true, nameEn: true } },
  commune: { select: { id: true, nameFr: true, nameAr: true, nameEn: true } },
  organization: { select: { id: true, slug: true, publicName: true, logoId: true } },
} satisfies Prisma.VolunteerMissionSelect;

export type MissionCardData = Prisma.VolunteerMissionGetPayload<{
  select: typeof missionCardSelect;
}>;

// ---------------------------------------------------------------------------
// Volunteer profile
// ---------------------------------------------------------------------------

export async function upsertVolunteerProfile(input: VolunteerProfileInput, auth: AuthContext) {
  const profile = await prisma.$transaction(async (tx) => {
    const saved = await tx.volunteerProfile.upsert({
      where: { userId: auth.user.id },
      create: {
        userId: auth.user.id,
        skills: input.skills,
        languages: input.languages,
        availability: input.availability,
        hasTransport: input.hasTransport,
        experience: input.experience ?? null,
        preferredActivities: input.preferredActivities,
        wilayaId: input.wilayaId ?? null,
        communeId: input.communeId ?? null,
        isSearchable: input.isSearchable,
      },
      update: {
        skills: input.skills,
        languages: input.languages,
        availability: input.availability,
        hasTransport: input.hasTransport,
        experience: input.experience ?? null,
        preferredActivities: input.preferredActivities,
        wilayaId: input.wilayaId ?? null,
        communeId: input.communeId ?? null,
        isSearchable: input.isSearchable,
      },
      select: { id: true, userId: true },
    });

    // Creating a profile grants the VOLUNTEER role — one of the two roles a
    // user may self-assign.
    const role = await tx.role.findUnique({ where: { name: 'VOLUNTEER' }, select: { id: true } });
    if (role) {
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: auth.user.id, roleId: role.id } },
        create: { userId: auth.user.id, roleId: role.id },
        update: {},
      });
    }

    return saved;
  });

  return profile;
}

export async function getVolunteerProfile(userId: string) {
  return prisma.volunteerProfile.findUnique({
    where: { userId },
    include: { wilaya: true, commune: true },
  });
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

export async function listPublicMissions(query: {
  page: number;
  pageSize: number;
  wilayaId?: number;
  categoryId?: number | string;
  organizationId?: string;
  q?: string;
}): Promise<Paginated<MissionCardData>> {
  const where: Prisma.VolunteerMissionWhereInput = {
    deletedAt: null,
    status: { in: ['OPEN', 'FULL'] },
  };

  if (query.wilayaId) where.wilayaId = query.wilayaId;
  if (typeof query.categoryId === 'string') where.categoryId = query.categoryId;
  if (query.organizationId) where.organizationId = query.organizationId;
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.volunteerMission.findMany({
      where,
      select: missionCardSelect,
      orderBy: { startsAt: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.volunteerMission.count({ where }),
  ]);

  return paginate(items, total, query.page, query.pageSize);
}

export async function getPublicMissionBySlug(slug: string, viewerId?: string) {
  const mission = await prisma.volunteerMission.findFirst({
    where: { slug, deletedAt: null, status: { in: ['OPEN', 'FULL', 'CLOSED', 'COMPLETED'] } },
    select: missionCardSelect,
  });
  if (!mission) return null;

  const myApplication = viewerId
    ? await prisma.volunteerApplication.findUnique({
        where: { missionId_userId: { missionId: mission.id, userId: viewerId } },
        select: { id: true, status: true, createdAt: true },
      })
    : null;

  return { ...mission, myApplication };
}

export async function createMission(input: CreateMissionInput, auth: AuthContext) {
  const membership = auth.organizations.find((o) => o.organizationId === input.organizationId);
  if (!membership) throw errors.forbidden();
  if (membership.verificationStatus !== 'VERIFIED') {
    throw errors.forbidden('Votre association doit être vérifiée pour publier une mission.');
  }

  const base = slugify(input.title) || 'mission';
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const exists = await prisma.volunteerMission.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!exists) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const mission = await prisma.volunteerMission.create({
    data: {
      slug,
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      organizationId: input.organizationId,
      campaignId: input.campaignId ?? null,
      status: input.saveAsDraft ? 'DRAFT' : 'OPEN',
      publishedAt: input.saveAsDraft ? null : new Date(),
      volunteersNeeded: input.volunteersNeeded,
      wilayaId: input.wilayaId,
      communeId: input.communeId ?? null,
      venue: input.venue ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      requirements: input.requirements ?? null,
    },
    select: { id: true, slug: true, title: true, status: true },
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'MISSION_CREATED',
    targetType: 'MISSION',
    targetId: mission.id,
    metadata: { organizationId: input.organizationId, status: mission.status },
  });

  return mission;
}

export async function applyToMission(missionId: string, message: string | undefined, auth: AuthContext) {
  const mission = await prisma.volunteerMission.findFirst({
    where: { id: missionId, deletedAt: null, status: 'OPEN' },
    select: {
      id: true,
      title: true,
      slug: true,
      organizationId: true,
      volunteersNeeded: true,
      volunteersAccepted: true,
      startsAt: true,
    },
  });
  if (!mission) throw errors.notFound();
  if (mission.startsAt.getTime() < Date.now()) {
    throw errors.conflict('Les candidatures pour cette mission sont closes.');
  }

  const existing = await prisma.volunteerApplication.findUnique({
    where: { missionId_userId: { missionId, userId: auth.user.id } },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== 'WITHDRAWN') {
    throw errors.conflict('Vous avez déjà postulé à cette mission.');
  }

  const application = await prisma.volunteerApplication.upsert({
    where: { missionId_userId: { missionId, userId: auth.user.id } },
    create: { missionId, userId: auth.user.id, message: message ?? null, status: 'PENDING' },
    update: { status: 'PENDING', message: message ?? null, reviewerId: null, reviewedAt: null },
    select: { id: true, status: true },
  });

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: mission.organizationId, role: { in: ['OWNER', 'ADMIN', 'MANAGER'] } },
    select: { userId: true },
  });

  await notifyMany(
    members.map((m) => m.userId),
    {
      type: 'VOLUNTEER_APPLICATION_RECEIVED',
      title: 'Nouvelle candidature bénévole',
      body: mission.title,
      targetType: 'MISSION',
      targetId: missionId,
      path: `/dashboard/missions/${missionId}`,
      push: false,
    },
  );

  return application;
}

export async function withdrawApplication(missionId: string, auth: AuthContext) {
  const result = await prisma.volunteerApplication.updateMany({
    where: { missionId, userId: auth.user.id, status: { in: ['PENDING', 'ACCEPTED'] } },
    data: { status: 'WITHDRAWN' },
  });
  if (result.count === 0) throw errors.notFound();
}

/**
 * Accept or reject a volunteer application.
 *
 * Acceptance increments the mission's accepted counter and closes it when
 * full — both inside one transaction, so two managers accepting at the same
 * moment cannot overshoot the requested headcount.
 */
export async function decideApplication(
  applicationId: string,
  decision: 'ACCEPTED' | 'REJECTED',
  note: string | undefined,
  auth: AuthContext,
) {
  const application = await prisma.volunteerApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      userId: true,
      mission: {
        select: {
          id: true,
          title: true,
          slug: true,
          venue: true,
          startsAt: true,
          organizationId: true,
          volunteersNeeded: true,
          volunteersAccepted: true,
          organization: { select: { publicName: true } },
        },
      },
    },
  });
  if (!application) throw errors.notFound();

  const isOrgManager = auth.organizations.some(
    (o) => o.organizationId === application.mission.organizationId && o.role !== 'MEMBER',
  );
  if (!isOrgManager && !auth.permissions.has(PERMISSIONS.MISSION_APPLICATION_REVIEW)) {
    throw errors.notFound();
  }

  if (application.status !== 'PENDING') {
    throw errors.conflict('Cette candidature a déjà été traitée.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.volunteerApplication.update({
      where: { id: applicationId },
      data: {
        status: decision,
        reviewerId: auth.user.id,
        reviewedAt: new Date(),
        decisionNote: note ?? null,
      },
    });

    if (decision === 'ACCEPTED') {
      const mission = await tx.volunteerMission.update({
        where: { id: application.mission.id },
        data: { volunteersAccepted: { increment: 1 } },
        select: { volunteersAccepted: true, volunteersNeeded: true, status: true },
      });

      if (mission.volunteersAccepted >= mission.volunteersNeeded && mission.status === 'OPEN') {
        await tx.volunteerMission.update({
          where: { id: application.mission.id },
          data: { status: 'FULL' as MissionStatus },
        });
      }
    }
  });

  await recordAudit({
    actorId: auth.user.id,
    action: 'MISSION_APPLICATION_DECIDED',
    targetType: 'MISSION',
    targetId: application.mission.id,
    metadata: { applicationId, decision },
  });

  await notify({
    userId: application.userId,
    type: decision === 'ACCEPTED' ? 'VOLUNTEER_ACCEPTED' : 'VOLUNTEER_REJECTED',
    title:
      decision === 'ACCEPTED'
        ? 'Votre candidature a été acceptée'
        : 'Votre candidature n’a pas été retenue',
    body: application.mission.title,
    targetType: 'MISSION',
    targetId: application.mission.id,
    path: `/volunteer/missions/${application.mission.slug}`,
    email: {
      template: decision === 'ACCEPTED' ? 'volunteer_accepted' : 'volunteer_rejected',
      vars: {
        missionTitle: application.mission.title,
        organizationName: application.mission.organization.publicName,
        date: application.mission.startsAt.toISOString(),
        location: application.mission.venue ?? '',
      },
    },
  });

  return { status: decision };
}

export async function listApplicationsForMission(missionId: string, auth: AuthContext) {
  const mission = await prisma.volunteerMission.findFirst({
    where: { id: missionId, deletedAt: null },
    select: { id: true, organizationId: true },
  });
  if (!mission) throw errors.notFound();

  const isOrgMember = auth.organizations.some(
    (o) => o.organizationId === mission.organizationId,
  );
  if (!isOrgMember && !auth.permissions.has(PERMISSIONS.MISSION_APPLICATION_REVIEW)) {
    throw errors.notFound();
  }

  return prisma.volunteerApplication.findMany({
    where: { missionId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      status: true,
      message: true,
      createdAt: true,
      reviewedAt: true,
      user: {
        select: {
          id: true,
          profile: { select: { firstName: true, lastName: true, avatarId: true } },
          volunteerProfile: {
            select: { skills: true, languages: true, hasTransport: true, totalHours: true },
          },
        },
      },
    },
  });
}

export async function listApplicationsForUser(userId: string, page: number, pageSize: number) {
  const where: Prisma.VolunteerApplicationWhereInput = { userId };
  const [items, total] = await Promise.all([
    prisma.volunteerApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        createdAt: true,
        hoursLogged: true,
        mission: {
          select: {
            id: true,
            slug: true,
            title: true,
            startsAt: true,
            venue: true,
            organization: { select: { publicName: true, slug: true } },
          },
        },
      },
    }),
    prisma.volunteerApplication.count({ where }),
  ]);
  return paginate(items, total, page, pageSize);
}

/**
 * Records volunteer hours after a mission.
 * Hours are added to the volunteer's running total in the same transaction so
 * the profile total always equals the sum of its applications.
 */
export async function logVolunteerHours(
  applicationId: string,
  hours: number,
  auth: AuthContext,
) {
  const application = await prisma.volunteerApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      userId: true,
      status: true,
      hoursLogged: true,
      mission: { select: { organizationId: true } },
    },
  });
  if (!application) throw errors.notFound();
  if (application.status !== 'ACCEPTED') {
    throw errors.conflict('Seules les candidatures acceptées peuvent enregistrer des heures.');
  }

  const isOrgManager = auth.organizations.some(
    (o) => o.organizationId === application.mission.organizationId && o.role !== 'MEMBER',
  );
  if (!isOrgManager) throw errors.notFound();

  const previous = Number(application.hoursLogged ?? 0);

  await prisma.$transaction(async (tx) => {
    await tx.volunteerApplication.update({
      where: { id: applicationId },
      data: { hoursLogged: hours },
    });

    await tx.volunteerProfile.updateMany({
      where: { userId: application.userId },
      // Adjust by the delta so re-recording corrects rather than double-counts.
      data: { totalHours: { increment: hours - previous } },
    });
  });

  return { hours };
}
