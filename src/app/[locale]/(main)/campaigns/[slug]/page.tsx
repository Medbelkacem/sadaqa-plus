import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, MapPin, Users } from 'lucide-react';

import { ShareRow } from '@/components/share/share-row';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { HelpIntentDialog } from '@/features/donations/help-intent-dialog';
import { DonateCard } from '@/features/donations/donate-card';
import { ReportDialog } from '@/features/moderation/report-dialog';
import { SaveButton } from '@/features/saved/save-button';
import { resolveLocale } from '@/i18n/server';
import { formatCurrency, formatDate, formatNumber, localizedName } from '@/i18n/format';
import { getAuthContext } from '@/server/auth/context';
import { paymentsConfigured } from '@/server/payments';
import { getPublicCampaignBySlug } from '@/server/services/campaign.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const campaign = await getPublicCampaignBySlug(slug);
  if (!campaign) return { title: 'Introuvable' };

  return {
    title: campaign.title,
    description: campaign.summary,
    alternates: { canonical: `/${locale}/campaigns/${slug}` },
    openGraph: {
      type: 'article',
      title: campaign.title,
      description: campaign.summary,
      url: `/${locale}/campaigns/${slug}`,
      ...(campaign.coverId ? { images: [`/api/files/${campaign.coverId}`] } : {}),
    },
  };
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, t, href } = await resolveLocale(params as Promise<{ locale: string }>);
  const { slug } = await params;

  const campaign = await getPublicCampaignBySlug(slug);
  if (!campaign) notFound();

  const auth = await getAuthContext();
  const { progress } = campaign;
  const isMonetary = campaign.goalType === 'MONETARY';

  const raised = isMonetary
    ? formatCurrency(progress.raisedAmount, locale, campaign.currency)
    : `${formatNumber(progress.raisedQuantity, locale)} ${campaign.unitLabel ?? ''}`.trim();

  const target = isMonetary
    ? campaign.targetAmount
      ? formatCurrency(Number(campaign.targetAmount), locale, campaign.currency)
      : null
    : campaign.targetQuantity
      ? `${formatNumber(campaign.targetQuantity, locale)} ${campaign.unitLabel ?? ''}`.trim()
      : null;

  return (
    <article className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted-fg">
        <Link href={href('/campaigns')} className="underline-offset-4 hover:underline">
          {t.campaigns.title}
        </Link>
      </nav>

      {campaign.coverId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/files/${campaign.coverId}`}
          alt=""
          className="mb-7 aspect-21/9 w-full rounded-[var(--radius-card)] border border-border object-cover"
        />
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{localizedName(campaign.category, locale)}</Badge>
            <Badge tone={campaign.status === 'ACTIVE' ? 'success' : 'neutral'}>
              {t.campaigns.status[campaign.status]}
            </Badge>
          </div>

          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-foreground">
            {campaign.title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-fg">{campaign.summary}</p>

          <dl className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-fg">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">{t.campaigns.period}</dt>
              <CalendarDays className="size-4" aria-hidden="true" />
              <dd>
                {formatDate(campaign.startDate, locale)}
                {campaign.endDate ? ` — ${formatDate(campaign.endDate, locale)}` : ''}
              </dd>
            </div>
            {campaign.wilaya ? (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">{t.requests.location}</dt>
                <MapPin className="size-4" aria-hidden="true" />
                <dd>{localizedName(campaign.wilaya, locale)}</dd>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">{t.donations.title}</dt>
              <Users className="size-4" aria-hidden="true" />
              <dd>
                {formatNumber(progress.donorCount, locale)} {t.donations.confirmed.toLowerCase()}
              </dd>
            </div>
          </dl>

          <div className="mt-7 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
            {campaign.description}
          </div>

          {/* --- Updates: only real ones, published by the organisation ---- */}
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-foreground">{t.campaigns.updates}</h2>

            {campaign.updates.length === 0 ? (
              <p className="mt-3 rounded-[var(--radius-card)] border border-dashed border-border bg-surface-muted/60 px-4 py-6 text-center text-sm text-muted-fg">
                {t.campaigns.noUpdates}
              </p>
            ) : (
              <ol className="mt-4 space-y-4">
                {campaign.updates.map((update) => (
                  <li key={update.id}>
                    <Card>
                      <CardContent className="pt-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{update.title}</h3>
                          <time
                            dateTime={update.publishedAt.toISOString()}
                            className="text-xs text-muted-fg"
                          >
                            {formatDate(update.publishedAt, locale)}
                          </time>
                        </div>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-fg">
                          {update.content}
                        </p>
                        {update.author.profile ? (
                          <p className="mt-3 text-xs text-muted-fg">
                            {t.common.by} {update.author.profile.firstName}{' '}
                            {update.author.profile.lastName.charAt(0)}.
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-5">
              <div>
                <p className="text-2xl font-bold tabular-nums text-foreground">{raised}</p>
                <p className="text-xs text-muted-fg">
                  {target ? `${t.campaigns.target}: ${target}` : t.campaigns.noTarget}
                </p>
              </div>

              <Progress value={progress.percent} label={t.campaigns.progress} />
              {progress.percent !== null ? (
                <p className="text-xs font-medium text-muted-fg">{progress.percent}%</p>
              ) : null}
            </CardContent>
          </Card>

          <DonateCard
            campaignId={campaign.id}
            configured={paymentsConfigured()}
            authenticated={Boolean(auth)}
          />

          <HelpIntentDialog
            targetType="CAMPAIGN"
            targetId={campaign.id}
            title={campaign.title}
            authenticated={Boolean(auth)}
          />

          <Card>
            <CardContent className="space-y-3 pt-5">
              <SaveButton
                targetType="CAMPAIGN"
                targetId={campaign.id}
                authenticated={Boolean(auth)}
              />
              <ShareRow title={campaign.title} path={`/${locale}/campaigns/${campaign.slug}`} />
              <ReportDialog
                targetType="CAMPAIGN"
                targetId={campaign.id}
                authenticated={Boolean(auth)}
              />
            </CardContent>
          </Card>

          {campaign.organization ? (
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                  {t.campaigns.organizer}
                </p>
                <Link
                  href={href(`/organizations/${campaign.organization.slug}`)}
                  className="mt-1.5 block text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {campaign.organization.publicName}
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
