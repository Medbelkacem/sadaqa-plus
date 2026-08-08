import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, MapPin, Users } from 'lucide-react';

import { ShareRow } from '@/components/share/share-row';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MissionApplyPanel } from '@/features/volunteer/mission-apply-panel';
import { resolveLocale } from '@/i18n/server';
import { formatDateTime, formatNumber, localizedName } from '@/i18n/format';
import { getAuthContext } from '@/server/auth/context';
import { getPublicMissionBySlug } from '@/server/services/volunteer.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const mission = await getPublicMissionBySlug(slug);
  if (!mission) return { title: 'Introuvable' };

  return {
    title: mission.title,
    description: mission.description.slice(0, 160),
    alternates: { canonical: `/${locale}/volunteer/missions/${slug}` },
  };
}

export default async function MissionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, t, href } = await resolveLocale(params as Promise<{ locale: string }>);
  const { slug } = await params;

  const auth = await getAuthContext();
  const mission = await getPublicMissionBySlug(slug, auth?.user.id);
  if (!mission) notFound();

  const remaining = Math.max(0, mission.volunteersNeeded - mission.volunteersAccepted);
  const place = mission.commune
    ? `${localizedName(mission.commune, locale)}, ${localizedName(mission.wilaya, locale)}`
    : localizedName(mission.wilaya, locale);

  return (
    <article className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted-fg">
        <Link href={href('/volunteer')} className="underline-offset-4 hover:underline">
          {t.volunteer.title}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{localizedName(mission.category, locale)}</Badge>
            <Badge tone={remaining === 0 ? 'neutral' : 'success'}>
              {remaining === 0
                ? t.volunteer.missionStatus.FULL
                : `${formatNumber(remaining, locale)} ${t.volunteer.missionsNeeded}`}
            </Badge>
          </div>

          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-foreground">
            {mission.title}
          </h1>

          <dl className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-fg">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">{t.events.when}</dt>
              <CalendarDays className="size-4" aria-hidden="true" />
              <dd>
                <time dateTime={mission.startsAt.toISOString()}>
                  {formatDateTime(mission.startsAt, locale)}
                </time>
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">{t.events.where}</dt>
              <MapPin className="size-4" aria-hidden="true" />
              <dd>{mission.venue ? `${mission.venue} · ${place}` : place}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">{t.volunteer.missions}</dt>
              <Users className="size-4" aria-hidden="true" />
              <dd>
                {formatNumber(mission.volunteersAccepted, locale)}/
                {formatNumber(mission.volunteersNeeded, locale)}
              </dd>
            </div>
          </dl>

          <div className="mt-7 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
            {mission.description}
          </div>

          {mission.requirements ? (
            <Card className="mt-6">
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                  {t.volunteer.skills}
                </p>
                <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">
                  {mission.requirements}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <MissionApplyPanel
            missionId={mission.id}
            application={mission.myApplication}
            open={mission.status === 'OPEN' && remaining > 0}
            authenticated={Boolean(auth)}
          />

          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                {t.campaigns.organizer}
              </p>
              <Link
                href={href(`/organizations/${mission.organization.slug}`)}
                className="mt-1.5 block text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                {mission.organization.publicName}
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <ShareRow
                title={mission.title}
                path={`/${locale}/volunteer/missions/${mission.slug}`}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </article>
  );
}
