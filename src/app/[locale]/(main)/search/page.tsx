import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchForm } from '@/features/search/search-form';
import { resolveLocale } from '@/i18n/server';
import { searchProvider, type SearchKind } from '@/server/services/search.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  // Search result pages carry no unique content worth indexing.
  return { title: t.search.title, robots: { index: false, follow: true } };
}

const PATH_BY_KIND: Record<SearchKind, string> = {
  requests: '/requests',
  campaigns: '/campaigns',
  events: '/events',
  organizations: '/organizations',
};

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t, href } = await resolveLocale(params);
  const raw = await searchParams;

  const query = typeof raw.q === 'string' ? raw.q : '';
  const kindParam = typeof raw.kinds === 'string' ? raw.kinds : '';
  const kinds = kindParam
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is SearchKind =>
      ['requests', 'campaigns', 'events', 'organizations'].includes(entry),
    );

  const results = await searchProvider().search(query, kinds, 20);

  const kindLabels: Record<SearchKind, string> = {
    requests: t.search.inRequests,
    campaigns: t.search.inCampaigns,
    events: t.search.inEvents,
    organizations: t.search.inOrganizations,
  };

  return (
    <>
      <PageHeader title={t.search.title} />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <SearchForm defaultQuery={query} defaultKinds={kinds} />

        <div className="mt-8">
          {query.length < 2 ? (
            <p className="text-sm text-muted-fg">{t.search.placeholder}</p>
          ) : results.hits.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t.empty.searchTitle}
              description={t.empty.searchBody}
            />
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-fg">
                {results.total} {t.common.results} · {t.search.resultsFor} “{results.query}”
              </p>

              <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
                {results.hits.map((hit) => (
                  <li key={`${hit.kind}-${hit.id}`}>
                    <Link
                      href={href(`${PATH_BY_KIND[hit.kind]}/${hit.slug}`)}
                      className="block p-4 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="outline">{kindLabels[hit.kind]}</Badge>
                        {hit.wilaya ? (
                          <span className="text-xs text-muted-fg">{hit.wilaya}</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-foreground">{hit.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-fg">{hit.excerpt}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}
