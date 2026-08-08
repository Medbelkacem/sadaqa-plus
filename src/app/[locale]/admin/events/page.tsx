import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusActions } from '@/features/admin/status-actions';
import { resolveLocale } from '@/i18n/server';
import { formatDateTime, localizedName } from '@/i18n/format';
import { requirePermission } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { prisma } from '@/server/db/prisma';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: `${t.admin.events} · ${t.admin.title}`, robots: { index: false } };
}

export default async function AdminEventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t, href } = await resolveLocale(params);
  await requirePermission(PERMISSIONS.EVENT_MODERATE);

  const events = await prisma.event.findMany({
    where: { deletedAt: null, status: { in: ['PENDING_REVIEW', 'PUBLISHED', 'ONGOING'] } },
    orderBy: [{ status: 'asc' }, { startsAt: 'asc' }],
    take: 50,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      status: true,
      startsAt: true,
      venue: true,
      category: { select: { nameFr: true, nameAr: true, nameEn: true } },
      wilaya: { select: { nameFr: true, nameAr: true, nameEn: true } },
      organization: { select: { publicName: true } },
      _count: { select: { registrations: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.admin.events}</h1>
      </header>

      {events.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title={t.empty.eventsTitle}
          description={t.empty.eventsBody}
        />
      ) : (
        <ul className="space-y-4">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-[var(--radius-card)] border border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        event.status === 'PENDING_REVIEW'
                          ? 'warning'
                          : event.status === 'PUBLISHED'
                            ? 'success'
                            : 'info'
                      }
                    >
                      {t.events.status[event.status]}
                    </Badge>
                    <span className="text-xs text-muted-fg">
                      {localizedName(event.category, locale)}
                    </span>
                  </div>

                  <h2 className="mt-2 text-base font-semibold text-foreground">
                    <Link
                      href={href(`/events/${event.slug}`)}
                      className="underline-offset-4 hover:underline"
                    >
                      {event.title}
                    </Link>
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-fg">{event.summary}</p>
                  <p className="mt-1 text-xs text-muted-fg">
                    {formatDateTime(event.startsAt, locale)} ·{' '}
                    {localizedName(event.wilaya, locale)} ·{' '}
                    {event._count.registrations} {t.events.participants.toLowerCase()}
                  </p>
                </div>

                <StatusActions
                  endpoint={`/api/events/${event.id}/status`}
                  current={event.status}
                  options={
                    event.status === 'PENDING_REVIEW'
                      ? [
                          { value: 'PUBLISHED', label: t.admin.approve, variant: 'primary' },
                          { value: 'CANCELLED', label: t.admin.reject, variant: 'danger' },
                        ]
                      : [
                          { value: 'ONGOING', label: t.events.status.ONGOING, variant: 'secondary' },
                          { value: 'COMPLETED', label: t.events.status.COMPLETED, variant: 'ghost' },
                          { value: 'CANCELLED', label: t.events.status.CANCELLED, variant: 'danger' },
                        ]
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
