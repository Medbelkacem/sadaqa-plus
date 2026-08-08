import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Megaphone } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { CampaignCard } from '@/features/campaigns/campaign-card';
import { resolveLocale } from '@/i18n/server';
import { listPublicCampaigns } from '@/server/services/campaign.service';
import { listCampaignsQuerySchema } from '@/validations/campaign';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t, locale } = await resolveLocale(params);
  return {
    title: t.campaigns.title,
    description: t.campaigns.subtitle,
    alternates: { canonical: `/${locale}/campaigns` },
  };
}

export default async function CampaignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t, href } = await resolveLocale(params);
  const raw = await searchParams;
  const parsed = listCampaignsQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : listCampaignsQuerySchema.parse({});

  const result = await listPublicCampaigns(query);

  return (
    <>
      <PageHeader
        title={t.campaigns.title}
        description={t.campaigns.subtitle}
        actions={
          <Button asChild variant="secondary">
            <Link href={href('/organizations/apply')}>{t.organizations.applyTitle}</Link>
          </Button>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {result.items.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={t.empty.campaignsTitle}
            description={t.empty.campaignsBody}
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} locale={locale} t={t} />
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
