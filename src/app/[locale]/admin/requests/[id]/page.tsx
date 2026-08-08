import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, FileText, Lock } from 'lucide-react';

import { RequestStatusBadge, UrgencyBadge } from '@/components/status/badges';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ModerationPanel } from '@/features/admin/moderation-panel';
import { resolveLocale } from '@/i18n/server';
import { formatDateTime, localizedName } from '@/i18n/format';
import { requirePermission } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { duplicateSignalsForRequest } from '@/server/services/moderation.service';
import { getRequestForActor } from '@/server/services/request.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: `${t.admin.requests} · ${t.admin.title}`, robots: { index: false } };
}

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, t, href } = await resolveLocale(params as Promise<{ locale: string }>);
  const { id } = await params;

  const auth = await requirePermission(PERMISSIONS.REQUEST_MODERATE);
  const { request } = await getRequestForActor(id, auth);
  const duplicates = await duplicateSignalsForRequest(id);

  // "Needs review" signals — never a fraud verdict. The moderator decides.
  const signals = duplicates.filter(
    (candidate) => candidate.sameAuthor || candidate.titleSimilarity >= 45,
  );

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-fg">
        <Link href={href('/admin/requests')} className="underline-offset-4 hover:underline">
          {t.admin.moderationQueue}
        </Link>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <RequestStatusBadge status={request.status} t={t} />
          <UrgencyBadge level={request.urgency} t={t} />
          <Badge tone="outline">{localizedName(request.category, locale)}</Badge>
          <span className="font-mono text-xs text-muted-fg">{request.reference}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{request.title}</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          {signals.length > 0 ? (
            <Alert tone="warning" icon={AlertTriangle} title={t.reports.needsReview}>
              <ul className="mt-1 space-y-1">
                {signals.map((signal) => (
                  <li key={signal.id}>
                    <Link
                      href={href(`/admin/requests/${signal.id}`)}
                      className="underline underline-offset-2"
                    >
                      {signal.reference} — {signal.title}
                    </Link>{' '}
                    <span className="text-xs">
                      ({signal.sameAuthor ? 'même auteur' : `${signal.titleSimilarity}%`})
                    </span>
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <Card>
            <CardContent className="pt-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                {t.requests.fields.description}
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                {request.description}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                {t.requests.steps.attachments}
              </h2>

              {request.attachments.length === 0 ? (
                <p className="mt-2 text-sm text-muted-fg">{t.common.none}</p>
              ) : (
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {request.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a
                        href={`/api/files/${attachment.file.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-2 rounded-xl border border-border p-3 text-center transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <FileText className="size-5 text-muted-fg" aria-hidden="true" />
                        <span className="truncate text-xs text-foreground">
                          {attachment.file.originalName}
                        </span>
                        <Badge tone="neutral">{attachment.visibility}</Badge>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                {t.admin.auditLogs}
              </h2>
              <ol className="mt-3 space-y-2">
                {request.statusEvents.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                    <span className="font-mono text-xs text-muted-fg">
                      {formatDateTime(event.createdAt, locale)}
                    </span>
                    <span className="text-foreground">
                      {event.fromStatus ?? '—'} → {event.toStatus}
                    </span>
                    {event.actor?.profile ? (
                      <span className="text-xs text-muted-fg">
                        {event.actor.profile.firstName} {event.actor.profile.lastName}
                      </span>
                    ) : null}
                    {event.note ? (
                      <span className="w-full text-xs text-muted-fg">{event.note}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <ModerationPanel requestId={request.id} status={request.status} />

          <Card>
            <CardContent className="space-y-2 pt-5 text-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                {t.requests.location}
              </h2>
              <p className="text-foreground">
                {request.commune ? `${localizedName(request.commune, locale)}, ` : ''}
                {localizedName(request.wilaya, locale)}
              </p>
              <p className="text-xs text-muted-fg">
                {t.requests.precision[request.locationPrecision]}
              </p>

              {request.addressPrivate ? (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-fg">
                  <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {request.addressPrivate}
                    <span className="mt-1 block opacity-80">
                      {t.requests.fields.addressPrivateHint}
                    </span>
                  </span>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1.5 pt-5 text-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                {t.requests.contactTitle}
              </h2>
              <p className="text-foreground">{request.contactMethod}</p>
              {request.contactPhone ? (
                <p dir="ltr" className="text-xs text-muted-fg">
                  {request.contactPhone}
                </p>
              ) : null}
              {request.contactEmail ? (
                <p dir="ltr" className="text-xs text-muted-fg">
                  {request.contactEmail}
                </p>
              ) : null}
              <p className="text-xs text-muted-fg">
                {request.contactPublic ? t.common.published : t.requests.contactHidden}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 pt-5 text-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
                {t.campaigns.organizer}
              </h2>
              <p className="text-foreground">
                {request.author.profile?.firstName} {request.author.profile?.lastName}
              </p>
              <p dir="ltr" className="text-xs text-muted-fg">
                {request.author.email}
              </p>
              {request.organization ? (
                <p className="text-xs text-muted-fg">{request.organization.publicName}</p>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
