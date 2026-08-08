import type { MetadataRoute } from 'next';

import { LOCALES } from '@/i18n/config';
import { prisma } from '@/server/db/prisma';

export const revalidate = 3600;

/**
 * Sitemap.
 *
 * Static pages in all three languages plus every genuinely public record.
 * Nothing behind authentication is listed, and on a fresh install the dynamic
 * half is simply empty — the sitemap is as small as the platform actually is.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const staticPaths = [
    { path: '', priority: 1, changeFrequency: 'daily' as const },
    { path: '/requests', priority: 0.9, changeFrequency: 'hourly' as const },
    { path: '/campaigns', priority: 0.9, changeFrequency: 'daily' as const },
    { path: '/events', priority: 0.8, changeFrequency: 'daily' as const },
    { path: '/volunteer', priority: 0.8, changeFrequency: 'daily' as const },
    { path: '/organizations', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/map', priority: 0.6, changeFrequency: 'daily' as const },
    { path: '/organizations/apply', priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/legal/terms', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/legal/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const page of staticPaths) {
      entries.push({
        url: `${appUrl}/${locale}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map((alt) => [alt, `${appUrl}/${alt}${page.path}`]),
          ),
        },
      });
    }
  }

  // Dynamic records. Capped so a large database cannot produce an oversized
  // sitemap; past that a sitemap index would be the right move.
  const [requests, campaigns, events, organizations] = await Promise.all([
    prisma.request.findMany({
      where: { deletedAt: null, status: { in: ['ACTIVE', 'PARTIALLY_HELPED', 'COMPLETED'] } },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 5000,
    }),
    prisma.campaign.findMany({
      where: { deletedAt: null, status: { in: ['ACTIVE', 'PAUSED', 'COMPLETED'] } },
      select: { slug: true, updatedAt: true },
      take: 2000,
    }),
    prisma.event.findMany({
      where: { deletedAt: null, status: { in: ['PUBLISHED', 'ONGOING', 'COMPLETED'] } },
      select: { slug: true, updatedAt: true },
      take: 2000,
    }),
    prisma.organization.findMany({
      where: { deletedAt: null, verificationStatus: 'VERIFIED' },
      select: { slug: true, updatedAt: true },
      take: 2000,
    }),
  ]).catch(() => [[], [], [], []] as const);

  const dynamicGroups = [
    { rows: requests, prefix: '/requests', priority: 0.8 },
    { rows: campaigns, prefix: '/campaigns', priority: 0.8 },
    { rows: events, prefix: '/events', priority: 0.7 },
    { rows: organizations, prefix: '/organizations', priority: 0.6 },
  ];

  for (const group of dynamicGroups) {
    for (const row of group.rows) {
      for (const locale of LOCALES) {
        entries.push({
          url: `${appUrl}/${locale}${group.prefix}/${row.slug}`,
          lastModified: row.updatedAt,
          changeFrequency: 'weekly',
          priority: group.priority,
        });
      }
    }
  }

  return entries;
}
