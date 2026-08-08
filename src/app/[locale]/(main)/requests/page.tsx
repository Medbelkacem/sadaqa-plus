import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ClipboardList, Plus } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { SkeletonList } from '@/components/ui/skeleton';
import { RequestCard } from '@/features/requests/request-card';
import { RequestFilters } from '@/features/requests/request-filters';
import { resolveLocale } from '@/i18n/server';
import { getCategories, getWilayas } from '@/server/services/reference.service';
import { listPublicRequests } from '@/server/services/request.service';
import { listRequestsQuerySchema } from '@/validations/request';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t, locale } = await resolveLocale(params);
  return {
    title: t.requests.title,
    description: t.requests.subtitle,
    alternates: { canonical: `/${locale}/requests` },
  };
}

export default async function RequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t, href } = await resolveLocale(params);
  const rawQuery = await searchParams;

  // Unknown or malformed query params fall back to defaults instead of 500ing.
  const parsed = listRequestsQuerySchema.safeParse(rawQuery);
  const query = parsed.success ? parsed.data : listRequestsQuerySchema.parse({});

  const [result, wilayas, categories] = await Promise.all([
    listPublicRequests(query),
    getWilayas(),
    getCategories('REQUEST'),
  ]);

  return (
    <>
      <PageHeader
        title={t.requests.title}
        description={t.requests.subtitle}
        actions={
          <Button asChild>
            <Link href={href('/requests/new')}>
              <Plus aria-hidden="true" />
              {t.requests.createTitle}
            </Link>
          </Button>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
          <aside>
            <Suspense fallback={<div className="h-96" aria-hidden="true" />}>
              <RequestFilters wilayas={wilayas} categories={categories} />
            </Suspense>
          </aside>

          <div>
            <p className="mb-4 text-sm text-muted-fg" aria-live="polite">
              {result.total} {t.common.results}
            </p>

            <Suspense fallback={<SkeletonList />}>
              {result.items.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title={
                    query.q || query.wilayaId || query.categoryId
                      ? t.empty.searchTitle
                      : t.empty.requestsTitle
                  }
                  description={
                    query.q || query.wilayaId || query.categoryId
                      ? t.empty.searchBody
                      : t.empty.requestsBody
                  }
                  action={
                    <Button asChild size="sm">
                      <Link href={href('/requests/new')}>{t.empty.requestsCta}</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {result.items.map((request) => (
                    <RequestCard key={request.id} request={request} locale={locale} t={t} />
                  ))}
                </div>
              )}
            </Suspense>

            <Suspense fallback={null}>
              <Pagination page={result.page} totalPages={result.totalPages} className="mt-8" />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}
