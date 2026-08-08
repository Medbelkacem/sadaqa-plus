import 'server-only';

import { unstable_cache } from 'next/cache';

import { prisma } from '@/server/db/prisma';

/**
 * Platform statistics.
 *
 * Every number here is a live `COUNT`/`SUM` against PostgreSQL. There is no
 * seeded baseline, no rounding up and no "since launch" padding. On a fresh
 * install every figure is genuinely 0 and the UI says so.
 */

export type PublicStats = {
  users: number;
  organizations: number;
  activeRequests: number;
  completedRequests: number;
  activeCampaigns: number;
  upcomingEvents: number;
  volunteers: number;
  confirmedDonationTotal: number;
  confirmedDonationCount: number;
};

async function computePublicStats(): Promise<PublicStats> {
  const now = new Date();

  const [
    users,
    organizations,
    activeRequests,
    completedRequests,
    activeCampaigns,
    upcomingEvents,
    volunteers,
    donationAggregate,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.organization.count({
      where: { deletedAt: null, verificationStatus: 'VERIFIED' },
    }),
    prisma.request.count({
      where: { deletedAt: null, status: { in: ['VERIFIED', 'ACTIVE', 'PARTIALLY_HELPED'] } },
    }),
    prisma.request.count({ where: { deletedAt: null, status: 'COMPLETED' } }),
    prisma.campaign.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.event.count({
      where: { deletedAt: null, status: 'PUBLISHED', startsAt: { gte: now } },
    }),
    prisma.volunteerProfile.count({
      where: { user: { deletedAt: null, status: 'ACTIVE' } },
    }),
    prisma.donation.aggregate({
      where: { status: 'CONFIRMED' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  return {
    users,
    organizations,
    activeRequests,
    completedRequests,
    activeCampaigns,
    upcomingEvents,
    volunteers,
    // `_sum` is null when no rows match — that is a real zero, not missing data.
    confirmedDonationTotal: Number(donationAggregate._sum.amount ?? 0),
    confirmedDonationCount: donationAggregate._count._all,
  };
}

/**
 * Cached for a minute. Homepage traffic should not put a burst of aggregate
 * queries on the primary; a 60-second lag on a public counter is harmless.
 */
export const getPublicStats = unstable_cache(computePublicStats, ['public-stats'], {
  revalidate: 60,
  tags: ['public-stats'],
});

export type AdminStats = PublicStats & {
  pendingRequests: number;
  underReviewRequests: number;
  rejectedRequests: number;
  pendingCampaigns: number;
  pendingOrganizations: number;
  pendingPartnerApplications: number;
  openReports: number;
  totalUsers: number;
  suspendedUsers: number;
  unverifiedUsers: number;
  donationIntents: number;
  volunteerApplicationsPending: number;
  eventRegistrations: number;
  messagesLast7Days: number;
  newUsersLast30Days: number;
};

/** Admin figures are never cached: moderators act on what they see. */
export async function getAdminStats(): Promise<AdminStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    base,
    pendingRequests,
    underReviewRequests,
    rejectedRequests,
    pendingCampaigns,
    pendingOrganizations,
    pendingPartnerApplications,
    openReports,
    totalUsers,
    suspendedUsers,
    unverifiedUsers,
    donationIntents,
    volunteerApplicationsPending,
    eventRegistrations,
    messagesLast7Days,
    newUsersLast30Days,
  ] = await Promise.all([
    computePublicStats(),
    prisma.request.count({ where: { deletedAt: null, status: 'PENDING_REVIEW' } }),
    prisma.request.count({ where: { deletedAt: null, status: 'UNDER_REVIEW' } }),
    prisma.request.count({ where: { deletedAt: null, status: 'REJECTED' } }),
    prisma.campaign.count({ where: { deletedAt: null, status: 'PENDING_REVIEW' } }),
    prisma.organization.count({
      where: { deletedAt: null, verificationStatus: { in: ['PENDING', 'UNDER_REVIEW'] } },
    }),
    prisma.partnerApplication.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
    prisma.report.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, status: 'SUSPENDED' } }),
    prisma.user.count({ where: { deletedAt: null, emailVerifiedAt: null } }),
    prisma.donationIntent.count(),
    prisma.volunteerApplication.count({ where: { status: 'PENDING' } }),
    prisma.eventRegistration.count(),
    prisma.message.count({ where: { createdAt: { gte: sevenDaysAgo }, deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } } }),
  ]);

  return {
    ...base,
    pendingRequests,
    underReviewRequests,
    rejectedRequests,
    pendingCampaigns,
    pendingOrganizations,
    pendingPartnerApplications,
    openReports,
    totalUsers,
    suspendedUsers,
    unverifiedUsers,
    donationIntents,
    volunteerApplicationsPending,
    eventRegistrations,
    messagesLast7Days,
    newUsersLast30Days,
  };
}

/**
 * Daily new-user and new-request counts for the admin charts.
 * Returns one row per day in range, including days with zero activity, so the
 * chart shows a truthful flat line rather than skipping empty days.
 */
export async function getDailySeries(days = 30) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const [users, requests] = await Promise.all([
    prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
      FROM users
      WHERE "createdAt" >= ${since} AND "deletedAt" IS NULL
      GROUP BY 1 ORDER BY 1
    `,
    prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
      FROM requests
      WHERE "createdAt" >= ${since} AND "deletedAt" IS NULL
      GROUP BY 1 ORDER BY 1
    `,
  ]);

  const key = (date: Date) => date.toISOString().slice(0, 10);
  const userMap = new Map(users.map((row) => [key(row.day), Number(row.count)]));
  const requestMap = new Map(requests.map((row) => [key(row.day), Number(row.count)]));

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(since);
    date.setDate(since.getDate() + index);
    const dayKey = key(date);
    return {
      date: dayKey,
      users: userMap.get(dayKey) ?? 0,
      requests: requestMap.get(dayKey) ?? 0,
    };
  });
}
