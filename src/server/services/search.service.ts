import 'server-only';

import { prisma } from '@/server/db/prisma';
import { PUBLIC_REQUEST_STATUSES } from '@/server/domain/request-workflow';

/**
 * Cross-entity search.
 *
 * Backed by PostgreSQL `ILIKE` over trigram-indexed columns (see the
 * `add_search_indexes` migration). That is the right tool at this scale and
 * costs no extra infrastructure.
 *
 * `SearchProvider` is the seam: swapping in OpenSearch/Meilisearch later means
 * implementing this one interface, not touching any page.
 */

export type SearchKind = 'requests' | 'campaigns' | 'events' | 'organizations';

export type SearchHit = {
  kind: SearchKind;
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  wilaya?: string | null;
};

export type SearchResults = {
  query: string;
  total: number;
  hits: SearchHit[];
  byKind: Record<SearchKind, number>;
};

export interface SearchProvider {
  search(query: string, kinds: SearchKind[], limit: number): Promise<SearchResults>;
}

class PostgresSearchProvider implements SearchProvider {
  async search(query: string, kinds: SearchKind[], limit: number): Promise<SearchResults> {
    const term = query.trim();

    // A blank query returns nothing rather than the whole database.
    if (term.length < 2) {
      return {
        query: term,
        total: 0,
        hits: [],
        byKind: { requests: 0, campaigns: 0, events: 0, organizations: 0 },
      };
    }

    const wants = (kind: SearchKind) => kinds.length === 0 || kinds.includes(kind);
    const contains = { contains: term, mode: 'insensitive' as const };

    const [requests, campaigns, events, organizations] = await Promise.all([
      wants('requests')
        ? prisma.request.findMany({
            where: {
              deletedAt: null,
              status: { in: PUBLIC_REQUEST_STATUSES },
              OR: [{ title: contains }, { description: contains }],
            },
            select: {
              id: true,
              slug: true,
              title: true,
              description: true,
              wilaya: { select: { nameFr: true } },
            },
            take: limit,
            orderBy: { publishedAt: 'desc' },
          })
        : [],

      wants('campaigns')
        ? prisma.campaign.findMany({
            where: {
              deletedAt: null,
              status: { in: ['ACTIVE', 'PAUSED', 'COMPLETED'] },
              OR: [{ title: contains }, { summary: contains }, { description: contains }],
            },
            select: {
              id: true,
              slug: true,
              title: true,
              summary: true,
              wilaya: { select: { nameFr: true } },
            },
            take: limit,
            orderBy: { publishedAt: 'desc' },
          })
        : [],

      wants('events')
        ? prisma.event.findMany({
            where: {
              deletedAt: null,
              status: { in: ['PUBLISHED', 'ONGOING', 'COMPLETED'] },
              OR: [{ title: contains }, { summary: contains }, { description: contains }],
            },
            select: {
              id: true,
              slug: true,
              title: true,
              summary: true,
              wilaya: { select: { nameFr: true } },
            },
            take: limit,
            orderBy: { startsAt: 'desc' },
          })
        : [],

      wants('organizations')
        ? prisma.organization.findMany({
            where: {
              deletedAt: null,
              verificationStatus: 'VERIFIED',
              OR: [{ publicName: contains }, { description: contains }],
            },
            select: {
              id: true,
              slug: true,
              publicName: true,
              description: true,
              wilaya: { select: { nameFr: true } },
            },
            take: limit,
          })
        : [],
    ]);

    const hits: SearchHit[] = [
      ...requests.map((row) => ({
        kind: 'requests' as const,
        id: row.id,
        slug: row.slug,
        title: row.title,
        excerpt: row.description.slice(0, 180),
        wilaya: row.wilaya?.nameFr,
      })),
      ...campaigns.map((row) => ({
        kind: 'campaigns' as const,
        id: row.id,
        slug: row.slug,
        title: row.title,
        excerpt: row.summary.slice(0, 180),
        wilaya: row.wilaya?.nameFr,
      })),
      ...events.map((row) => ({
        kind: 'events' as const,
        id: row.id,
        slug: row.slug,
        title: row.title,
        excerpt: row.summary.slice(0, 180),
        wilaya: row.wilaya?.nameFr,
      })),
      ...organizations.map((row) => ({
        kind: 'organizations' as const,
        id: row.id,
        slug: row.slug,
        title: row.publicName,
        excerpt: row.description.slice(0, 180),
        wilaya: row.wilaya?.nameFr,
      })),
    ];

    return {
      query: term,
      total: hits.length,
      hits,
      byKind: {
        requests: requests.length,
        campaigns: campaigns.length,
        events: events.length,
        organizations: organizations.length,
      },
    };
  }
}

let provider: SearchProvider | null = null;

export function searchProvider(): SearchProvider {
  provider ??= new PostgresSearchProvider();
  return provider;
}
