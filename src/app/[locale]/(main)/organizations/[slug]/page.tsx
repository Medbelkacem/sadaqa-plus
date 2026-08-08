import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Globe, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';

import { ShareRow } from '@/components/share/share-row';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/misc';
import { CampaignCard } from '@/features/campaigns/campaign-card';
import { EventCard } from '@/features/events/event-card';
import { ReportDialog } from '@/features/moderation/report-dialog';
import { resolveLocale } from '@/i18n/server';
import { formatDate, localizedName } from '@/i18n/format';
import { getAuthContext } from '@/server/auth/context';
import { listPublicCampaigns } from '@/server/services/campaign.service';
import { listPublicEvents } from '@/server/services/event.service';
import { getPublicOrganizationBySlug } from '@/server/services/organization.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const organization = await getPublicOrganizationBySlug(slug);
  if (!organization) return { title: 'Introuvable' };

  return {
    title: organization.publicName,
    description: organization.description.slice(0, 160),
    alternates: { canonical: `/${locale}/organizations/${slug}` },
  };
}

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, t } = await resolveLocale(params as Promise<{ locale: string }>);
  const { slug } = await params;

  const organization = await getPublicOrganizationBySlug(slug);
  if (!organization) notFound();

  const auth = await getAuthContext();

  const [campaigns, events] = await Promise.all([
    listPublicCampaigns({ page: 1, pageSize: 6, organizationId: organization.id }),
    listPublicEvents({ page: 1, pageSize: 6, organizationId: organization.id, upcomingOnly: true }),
  ]);

  const links = [
    organization.website ? { icon: Globe, label: organization.website, url: organization.website } : null,
    organization.email ? { icon: Mail, label: organization.email, url: `mailto:${organization.email}` } : null,
    organization.phone ? { icon: Phone, label: organization.phone, url: `tel:${organization.phone}` } : null,
  ].filter(Boolean) as { icon: typeof Globe; label: string; url: string }[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start gap-5">
        <Avatar
          name={organization.publicName}
          src={organization.logoId ? `/api/files/${organization.logoId}` : null}
          size={72}
          className="rounded-2xl"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {organization.publicName}
            </h1>
            <Badge tone="success">
              <ShieldCheck aria-hidden="true" />
              {t.verification.verified}
            </Badge>
            {organization.isSadaqaTeam ? <Badge tone="accent">Sadaqa+</Badge> : null}
          </div>

          {organization.wilaya ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-fg">
              <MapPin className="size-4" aria-hidden="true" />
              {localizedName(organization.wilaya, locale)}
            </p>
          ) : null}

          {organization.verifiedAt ? (
            <p className="mt-1 text-xs text-muted-fg">
              {t.verification.verified} · {formatDate(organization.verifiedAt, locale)}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-10">
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
            {organization.description}
          </p>

          {organization.areasOfWork.length > 0 ? (
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {t.organizations.areasOfWork}
              </h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {organization.areasOfWork.map((area) => (
                  <li key={area}>
                    <Badge tone="outline">{area}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t.campaigns.title}</h2>
            <div className="mt-4">
              {campaigns.items.length === 0 ? (
                <EmptyState
                  compact
                  title={t.empty.campaignsTitle}
                  description={t.empty.campaignsBody}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {campaigns.items.map((campaign) => (
                    <CampaignCard key={campaign.id} campaign={campaign} locale={locale} t={t} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">{t.events.title}</h2>
            <div className="mt-4">
              {events.items.length === 0 ? (
                <EmptyState compact title={t.empty.eventsTitle} description={t.empty.eventsBody} />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {events.items.map((event) => (
                    <EventCard key={event.id} event={event} locale={locale} t={t} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          {links.length > 0 ? (
            <Card>
              <CardContent className="space-y-2 pt-5">
                {links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target={link.url.startsWith('http') ? '_blank' : undefined}
                    rel={link.url.startsWith('http') ? 'noopener noreferrer nofollow' : undefined}
                    dir="ltr"
                    className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <link.icon className="size-4 shrink-0 text-muted-fg" aria-hidden="true" />
                    <span className="truncate">{link.label}</span>
                  </a>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {organization.coverage.length > 0 ? (
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                  {t.organizations.coverage}
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {organization.coverage.map((entry) => (
                    <li key={entry.wilaya.id}>
                      <Badge tone="neutral">{localizedName(entry.wilaya, locale)}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="space-y-3 pt-5">
              <ShareRow
                title={organization.publicName}
                path={`/${locale}/organizations/${organization.slug}`}
              />
              <ReportDialog
                targetType="ORGANIZATION"
                targetId={organization.id}
                authenticated={Boolean(auth)}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
