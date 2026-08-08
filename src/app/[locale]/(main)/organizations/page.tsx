import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { BadgeCheck } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { OrganizationCard } from '@/features/organizations/organization-card';
import { resolveLocale } from '@/i18n/server';
import { listVerifiedOrganizations } from '@/server/services/organization.service';
import { listOrganizationsQuerySchema } from '@/validations/organization';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t, locale } = await resolveLocale(params);
  return {
    title: t.organizations.title,
    description: t.organizations.subtitle,
    alternates: { canonical: `/${locale}/organizations` },
  };
}

export default async function OrganizationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t, href } = await resolveLocale(params);
  const raw = await searchParams;
  const parsed = listOrganizationsQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : listOrganizationsQuerySchema.parse({});

  // Only VERIFIED organizations. The directory starts empty and stays empty
  // until a real partnership application is approved.
  const result = await listVerifiedOrganizations(query);

  return (
    <>
      <PageHeader
        title={t.organizations.title}
        description={t.organizations.subtitle}
        actions={
          <Button asChild>
            <Link href={href('/organizations/apply')}>{t.organizations.applyTitle}</Link>
          </Button>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {result.items.length === 0 ? (
          <EmptyState
            icon={BadgeCheck}
            title={t.empty.organizationsTitle}
            description={t.empty.organizationsBody}
            action={
              <Button asChild size="sm">
                <Link href={href('/organizations/apply')}>{t.empty.organizationsCta}</Link>
              </Button>
            }
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-fg">
              {result.total} {t.common.results}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {result.items.map((organization) => (
                <OrganizationCard
                  key={organization.id}
                  organization={organization}
                  locale={locale}
                  t={t}
                />
              ))}
            </div>
            <Suspense fallback={null}>
              <Pagination page={result.page} totalPages={result.totalPages} className="mt-8" />
            </Suspense>
          </>
        )}
      </div>
    </>
  );
}
