import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, Hash, MapPin, ShieldCheck, Users } from 'lucide-react';

import { ContactPanel } from '@/features/requests/contact-panel';
import { HelpIntentDialog } from '@/features/donations/help-intent-dialog';
import { ReportDialog } from '@/features/moderation/report-dialog';
import { SaveButton } from '@/features/saved/save-button';
import { ShareRow } from '@/components/share/share-row';
import { UrgencyBadge } from '@/components/status/badges';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { resolveLocale } from '@/i18n/server';
import { formatDate, localizedName } from '@/i18n/format';
import { getAuthContext } from '@/server/auth/context';
import { getPublicRequestBySlug, trackRequestView } from '@/server/services/request.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const request = await getPublicRequestBySlug(slug);
  if (!request) return { title: 'Introuvable' };

  const description = request.description.slice(0, 160);

  return {
    title: request.title,
    description,
    alternates: { canonical: `/${locale}/requests/${slug}` },
    openGraph: {
      type: 'article',
      title: request.title,
      description,
      url: `/${locale}/requests/${slug}`,
    },
    twitter: { card: 'summary_large_image', title: request.title, description },
  };
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, t, href } = await resolveLocale(params as Promise<{ locale: string }>);
  const { slug } = await params;

  const request = await getPublicRequestBySlug(slug);
  if (!request) notFound();

  const auth = await getAuthContext();

  // Fire-and-forget: a failed counter update must not break the page.
  void trackRequestView(request.id);

  const place = request.commune
    ? `${localizedName(request.commune, locale)}, ${localizedName(request.wilaya, locale)}`
    : localizedName(request.wilaya, locale);

  const authorName = request.author.profile
    ? `${request.author.profile.firstName} ${request.author.profile.lastName.charAt(0)}.`
    : t.common.anonymous;

  const verification = request.verifications[0];

  return (
    <article className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted-fg">
        <Link href={href('/requests')} className="underline-offset-4 hover:underline">
          {t.requests.title}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone="neutral"
              style={
                request.category.color
                  ? {
                      borderColor: `${request.category.color}44`,
                      color: request.category.color,
                      backgroundColor: `${request.category.color}12`,
                    }
                  : undefined
              }
            >
              {localizedName(request.category, locale)}
            </Badge>
            <UrgencyBadge level={request.urgency} t={t} />
            <Badge tone="success">
              <ShieldCheck aria-hidden="true" />
              {t.verification.verified}
            </Badge>
          </div>

          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-foreground">
            {request.title}
          </h1>

          <dl className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-fg">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">{t.requests.location}</dt>
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              <dd>{place}</dd>
            </div>
            {request.publishedAt ? (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">{t.requests.publishedOn}</dt>
                <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                <dd>
                  <time dateTime={request.publishedAt.toISOString()}>
                    {formatDate(request.publishedAt, locale)}
                  </time>
                </dd>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">{t.requests.reference}</dt>
              <Hash className="size-4 shrink-0" aria-hidden="true" />
              <dd className="font-mono text-xs">{request.reference}</dd>
            </div>
            {request.beneficiaryCount ? (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">{t.requests.beneficiaries}</dt>
                <Users className="size-4 shrink-0" aria-hidden="true" />
                <dd>{request.beneficiaryCount}</dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-7 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
            {request.description}
          </div>

          {request.quantity ? (
            <Card className="mt-6">
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                  {t.requests.quantity}
                </p>
                <p className="mt-1.5 text-sm text-foreground">{request.quantity}</p>
              </CardContent>
            </Card>
          ) : null}

          {request.attachments.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-foreground">
                {t.requests.steps.attachments}
              </h2>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {request.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <a
                      href={`/api/files/${attachment.file.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {attachment.file.mimeType.startsWith('image/') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/files/${attachment.file.id}`}
                          alt={attachment.label ?? ''}
                          loading="lazy"
                          className="aspect-4/3 w-full object-cover"
                        />
                      ) : (
                        <span className="flex aspect-4/3 items-center justify-center bg-surface-muted p-3 text-center text-xs text-muted-fg">
                          {attachment.file.originalName}
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {verification ? (
            <p className="mt-8 rounded-[var(--radius-card)] border border-success/25 bg-success-soft px-4 py-3 text-sm text-success-soft-fg">
              {t.verification.verifiedBy} · {formatDate(verification.createdAt, locale)}
            </p>
          ) : null}
        </div>

        <aside className="space-y-4">
          <ContactPanel request={request} authorName={authorName} t={t} authenticated={Boolean(auth)} />

          <HelpIntentDialog
            targetType="REQUEST"
            targetId={request.id}
            title={request.title}
            authenticated={Boolean(auth)}
          />

          <Card>
            <CardContent className="space-y-3 pt-5">
              <SaveButton targetType="REQUEST" targetId={request.id} authenticated={Boolean(auth)} />
              <ShareRow
                title={request.title}
                path={`/${locale}/requests/${request.slug}`}
              />
              <ReportDialog targetType="REQUEST" targetId={request.id} authenticated={Boolean(auth)} />
            </CardContent>
          </Card>

          {request.organization ? (
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                  {t.campaigns.organizer}
                </p>
                <Link
                  href={href(`/organizations/${request.organization.slug}`)}
                  className="mt-1.5 block text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {request.organization.publicName}
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
