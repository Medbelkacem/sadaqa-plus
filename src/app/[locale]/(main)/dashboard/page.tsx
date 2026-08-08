import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Bookmark,
  Building2,
  CalendarDays,
  ClipboardList,
  HandCoins,
  HeartHandshake,
  Megaphone,
  ShieldCheck,
} from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { RequestStatusBadge } from '@/components/status/badges';
import { resolveLocale } from '@/i18n/server';
import { formatRelative } from '@/i18n/format';
import { getAuthContext } from '@/server/auth/context';
import { prisma } from '@/server/db/prisma';
import { listRequestsForAuthor } from '@/server/services/request.service';
import { listApplicationsForUser } from '@/server/services/volunteer.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.nav.dashboard, robots: { index: false, follow: false } };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t, href } = await resolveLocale(params);

  const auth = await getAuthContext();
  if (!auth) {
    redirect(`${href('/auth/login')}?next=${encodeURIComponent(href('/dashboard'))}`);
  }

  const [myRequests, myApplications, savedCount, registrationCount, intentCount] =
    await Promise.all([
      listRequestsForAuthor(auth.user.id, 1, 5),
      listApplicationsForUser(auth.user.id, 1, 5),
      prisma.savedItem.count({ where: { userId: auth.user.id } }),
      prisma.eventRegistration.count({
        where: { userId: auth.user.id, status: { in: ['REGISTERED', 'ATTENDED'] } },
      }),
      prisma.donationIntent.count({ where: { userId: auth.user.id } }),
    ]);

  const quickLinks = [
    {
      icon: ClipboardList,
      title: t.dashboard.urgentNeeds,
      path: '/requests?sort=urgency',
    },
    { icon: Megaphone, title: t.dashboard.campaigns, path: '/campaigns' },
    { icon: HeartHandshake, title: t.dashboard.missions, path: '/volunteer' },
    { icon: CalendarDays, title: t.dashboard.events, path: '/events' },
  ];

  const activity = [
    { icon: ClipboardList, label: t.dashboard.myRequests, value: myRequests.total, path: '/dashboard/requests' },
    { icon: HeartHandshake, label: t.dashboard.myApplications, value: myApplications.total, path: '/dashboard/applications' },
    { icon: CalendarDays, label: t.dashboard.myRegistrations, value: registrationCount, path: '/events' },
    { icon: HandCoins, label: t.dashboard.myDonations, value: intentCount, path: '/dashboard/donations' },
    { icon: Bookmark, label: t.dashboard.savedItems, value: savedCount, path: '/dashboard/saved' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t.dashboard.greeting} {auth.user.firstName} 👋
        </h1>
        <p className="mt-2 text-sm text-muted-fg">{t.dashboard.prompt}</p>
      </header>

      {!auth.user.emailVerified ? (
        <Alert tone="warning" className="mt-6" title={t.auth.emailNotVerified}>
          {t.auth.verifyEmailPending}
        </Alert>
      ) : null}

      {auth.organizations.length > 0 ? (
        <Card className="mt-6 border-accent/25 bg-accent-soft/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
            <div className="flex items-center gap-3">
              <Building2 className="size-5 text-accent" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {auth.organizations[0].publicName}
                </p>
                <p className="text-xs text-muted-fg">
                  {t.organizations.memberRole[auth.organizations[0].role]}
                </p>
              </div>
              {auth.organizations[0].verificationStatus === 'VERIFIED' ? (
                <Badge tone="success">
                  <ShieldCheck aria-hidden="true" />
                  {t.verification.verified}
                </Badge>
              ) : (
                <Badge tone="warning">{t.verification.pending}</Badge>
              )}
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href={href(`/organizations/${auth.organizations[0].slug}/manage`)}>
                {t.dashboard.organizationSpace}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="mt-8">
        <h2 className="sr-only">{t.nav.explore}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Card key={link.path} interactive className="relative">
              <CardContent className="flex items-center gap-3 pt-5">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-fg"
                  aria-hidden="true"
                >
                  <link.icon className="size-5" />
                </span>
                <Link
                  href={href(link.path)}
                  className="text-sm font-semibold text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link.title}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">{t.dashboard.myActivity}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {activity.map((item) => (
            <Link
              key={item.label}
              href={href(item.path)}
              className="rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <dt className="flex items-center gap-2 text-xs font-medium text-muted-fg">
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </dt>
              <dd className="mt-2 text-2xl font-bold tabular-nums text-foreground">
                {item.value}
              </dd>
            </Link>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{t.dashboard.myRequests}</h2>
          <Button asChild size="sm" variant="ghost">
            <Link href={href('/requests/new')}>{t.requests.createTitle}</Link>
          </Button>
        </div>

        <div className="mt-4">
          {myRequests.items.length === 0 ? (
            <EmptyState
              compact
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
            <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
              {myRequests.items.map((request) => (
                <li key={request.id} className="flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={href(`/requests/${request.slug}`)}
                      className="truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {request.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-fg">
                      {request.reference} · {formatRelative(request.createdAt, locale)}
                    </p>
                  </div>
                  <RequestStatusBadge status={request.status} t={t} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
