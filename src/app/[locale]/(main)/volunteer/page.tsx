import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { HeartHandshake } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { MissionCard } from '@/features/volunteer/mission-card';
import { resolveLocale } from '@/i18n/server';
import { listPublicMissions } from '@/server/services/volunteer.service';
import { listMissionsQuerySchema } from '@/validations/volunteer';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t, locale } = await resolveLocale(params);
  return {
    title: t.volunteer.title,
    description: t.volunteer.subtitle,
    alternates: { canonical: `/${locale}/volunteer` },
  };
}

export default async function VolunteerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t, href } = await resolveLocale(params);
  const raw = await searchParams;
  const parsed = listMissionsQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : listMissionsQuerySchema.parse({});

  const result = await listPublicMissions(query);

  return (
    <>
      <PageHeader
        title={t.volunteer.title}
        description={t.volunteer.subtitle}
        actions={
          <Button asChild>
            <Link href={href('/volunteer/profile')}>{t.volunteer.becomeVolunteer}</Link>
          </Button>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {result.items.length === 0 ? (
          <EmptyState
            icon={HeartHandshake}
            title={t.empty.missionsTitle}
            description={t.empty.missionsBody}
            action={
              <Button asChild size="sm">
                <Link href={href('/volunteer/profile')}>{t.empty.missionsCta}</Link>
              </Button>
            }
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-fg">
              {result.total} {t.common.results}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((mission) => (
                <MissionCard key={mission.id} mission={mission} locale={locale} t={t} />
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
