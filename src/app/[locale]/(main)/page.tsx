import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  HandHeart,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { CampaignCard } from '@/features/campaigns/campaign-card';
import { EventCard } from '@/features/events/event-card';
import { RequestCard } from '@/features/requests/request-card';
import { OrganizationCard } from '@/features/organizations/organization-card';
import { StatGrid } from '@/components/stats/stat-grid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { resolveLocale } from '@/i18n/server';
import { listPublicCampaigns } from '@/server/services/campaign.service';
import { listPublicEvents } from '@/server/services/event.service';
import { listPublicRequests } from '@/server/services/request.service';
import { listVerifiedOrganizations } from '@/server/services/organization.service';
import { getPublicStats } from '@/server/services/stats.service';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t, href } = await resolveLocale(params);

  // Everything below reflects the real database. On a fresh install each of
  // these comes back empty and the corresponding section renders its empty
  // state instead of placeholder cards.
  const [stats, urgent, campaigns, events, organizations] = await Promise.all([
    getPublicStats(),
    listPublicRequests({ page: 1, pageSize: 3, sort: 'urgency' }),
    listPublicCampaigns({ page: 1, pageSize: 3 }),
    listPublicEvents({ page: 1, pageSize: 3, upcomingOnly: true }),
    listVerifiedOrganizations({ page: 1, pageSize: 4 }),
  ]);

  const steps = [
    { icon: ClipboardList, title: t.home.step1Title, body: t.home.step1Body },
    { icon: ShieldCheck, title: t.home.step2Title, body: t.home.step2Body },
    { icon: HandHeart, title: t.home.step3Title, body: t.home.step3Body },
  ];

  const faqs = [
    { q: t.faq.q1, a: t.faq.a1 },
    { q: t.faq.q2, a: t.faq.a2 },
    { q: t.faq.q3, a: t.faq.a3 },
    { q: t.faq.q4, a: t.faq.a4 },
    { q: t.faq.q5, a: t.faq.a5 },
  ];

  return (
    <>
      {/* --- Hero ---------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_32rem_at_50%_-8rem,var(--primary-soft),transparent_70%)] opacity-90"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-fg">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              {t.brand.name} · {t.footer.builtIn}
            </p>

            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
              {t.home.heroTitle}
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-fg sm:text-lg">
              {t.brand.description}
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={href('/requests')}>
                  {t.home.heroCta}
                  <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                <Link href={href('/requests/new')}>{t.home.heroCtaSecondary}</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto">
                <Link href={href('/volunteer')}>{t.home.heroCtaTertiary}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* --- How it works -------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading title={t.home.howItWorks} subtitle={t.home.howItWorksSubtitle} />
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title}>
              <Card className="h-full">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary-soft-fg"
                      aria-hidden="true"
                    >
                      <step.icon className="size-5" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-fg">{step.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* --- Urgent needs -------------------------------------------------- */}
      <section className="border-t border-border bg-surface-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            title={t.home.urgentTitle}
            subtitle={t.home.urgentSubtitle}
            action={
              urgent.total > 0 ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={href('/requests')}>
                    {t.common.seeAll}
                    <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
                  </Link>
                </Button>
              ) : null
            }
          />

          <div className="mt-8">
            {urgent.items.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={t.empty.requestsTitle}
                description={t.empty.requestsBody}
                action={
                  <Button asChild size="sm">
                    <Link href={href('/requests/new')}>{t.empty.requestsCta}</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {urgent.items.map((request) => (
                  <RequestCard key={request.id} request={request} locale={locale} t={t} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* --- Campaigns ----------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          title={t.home.campaignsTitle}
          subtitle={t.home.campaignsSubtitle}
          action={
            campaigns.total > 0 ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={href('/campaigns')}>
                  {t.common.seeAll}
                  <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
            ) : null
          }
        />

        <div className="mt-8">
          {campaigns.items.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title={t.empty.campaignsTitle}
              description={t.empty.campaignsBody}
              action={
                <Button asChild size="sm" variant="secondary">
                  <Link href={href('/organizations/apply')}>{t.organizations.applyTitle}</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.items.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} locale={locale} t={t} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* --- Events -------------------------------------------------------- */}
      <section className="border-t border-border bg-surface-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            title={t.home.eventsTitle}
            subtitle={t.home.eventsSubtitle}
            action={
              events.total > 0 ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={href('/events')}>
                    {t.common.seeAll}
                    <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
                  </Link>
                </Button>
              ) : null
            }
          />

          <div className="mt-8">
            {events.items.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title={t.empty.eventsTitle}
                description={t.empty.eventsBody}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {events.items.map((event) => (
                  <EventCard key={event.id} event={event} locale={locale} t={t} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* --- Volunteer CTA ------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Card className="overflow-hidden border-primary/20 bg-primary-soft/60">
          <CardContent className="flex flex-col items-start gap-6 p-8 sm:p-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {t.home.volunteerTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-fg">{t.home.volunteerBody}</p>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link href={href('/volunteer')}>
                <Users aria-hidden="true" />
                {t.home.volunteerCta}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* --- Organizations ------------------------------------------------- */}
      <section className="border-t border-border bg-surface-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            title={t.home.organizationsTitle}
            subtitle={t.home.organizationsSubtitle}
            action={
              organizations.total > 0 ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={href('/organizations')}>
                    {t.common.seeAll}
                    <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
                  </Link>
                </Button>
              ) : null
            }
          />

          <div className="mt-8">
            {organizations.items.length === 0 ? (
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {organizations.items.map((organization) => (
                  <OrganizationCard
                    key={organization.id}
                    organization={organization}
                    locale={locale}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* --- Transparency -------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading title={t.home.transparencyTitle} subtitle={t.home.transparencySubtitle} />
        <div className="mt-8">
          <StatGrid stats={stats} locale={locale} t={t} />
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-fg">
            {t.home.transparencyNote}
          </p>
        </div>
      </section>

      {/* --- FAQ ----------------------------------------------------------- */}
      <section className="border-t border-border bg-surface-muted/40">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading title={t.home.faqTitle} />
          <dl className="mt-8 divide-y divide-border">
            {faqs.map((faq) => (
              <div key={faq.q} className="py-5">
                <dt className="text-sm font-semibold text-foreground">{faq.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-fg">{faq.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --- Final CTA ----------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {t.home.finalCtaTitle}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-fg">{t.home.finalCtaBody}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={href('/requests/new')}>{t.home.heroCtaSecondary}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={href('/campaigns')}>{t.nav.campaigns}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h2>
        {subtitle ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-fg">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
