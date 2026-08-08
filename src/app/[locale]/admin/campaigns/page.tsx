import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusActions } from '@/features/admin/status-actions';
import { resolveLocale } from '@/i18n/server';
import { formatRelative, localizedName } from '@/i18n/format';
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
  return { title: `${t.admin.campaigns} · ${t.admin.title}`, robots: { index: false } };
}

export default async function AdminCampaignsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale, t, href } = await resolveLocale(params);
  await requirePermission(PERMISSIONS.CAMPAIGN_MODERATE);

  // Awaiting approval first, then everything currently live.
  const campaigns = await prisma.campaign.findMany({
    where: { deletedAt: null, status: { in: ['PENDING_REVIEW', 'ACTIVE', 'PAUSED'] } },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    take: 50,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      status: true,
      createdAt: true,
      category: { select: { nameFr: true, nameAr: true, nameEn: true } },
      organization: { select: { publicName: true, verificationStatus: true } },
    },
  });

  const pending = campaigns.filter((campaign) => campaign.status === 'PENDING_REVIEW');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.admin.campaigns}</h1>
        <p className="mt-1.5 text-sm text-muted-fg">
          {pending.length} · {t.dashboard.pendingReview}
        </p>
      </header>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title={t.empty.campaignsTitle}
          description={t.empty.campaignsBody}
        />
      ) : (
        <ul className="space-y-4">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="rounded-[var(--radius-card)] border border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        campaign.status === 'PENDING_REVIEW'
                          ? 'warning'
                          : campaign.status === 'ACTIVE'
                            ? 'success'
                            : 'neutral'
                      }
                    >
                      {t.campaigns.status[campaign.status]}
                    </Badge>
                    <span className="text-xs text-muted-fg">
                      {localizedName(campaign.category, locale)}
                    </span>
                  </div>

                  <h2 className="mt-2 text-base font-semibold text-foreground">
                    <Link
                      href={href(`/campaigns/${campaign.slug}`)}
                      className="underline-offset-4 hover:underline"
                    >
                      {campaign.title}
                    </Link>
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-fg">{campaign.summary}</p>
                  <p className="mt-1 text-xs text-muted-fg">
                    {campaign.organization?.publicName ?? 'Sadaqa+'} ·{' '}
                    {formatRelative(campaign.createdAt, locale)}
                  </p>
                </div>

                <StatusActions
                  endpoint={`/api/campaigns/${campaign.id}/status`}
                  current={campaign.status}
                  options={
                    campaign.status === 'PENDING_REVIEW'
                      ? [
                          { value: 'ACTIVE', label: t.admin.approve, variant: 'primary' },
                          { value: 'CANCELLED', label: t.admin.reject, variant: 'danger' },
                        ]
                      : campaign.status === 'ACTIVE'
                        ? [
                            { value: 'PAUSED', label: t.campaigns.status.PAUSED, variant: 'secondary' },
                            { value: 'COMPLETED', label: t.campaigns.status.COMPLETED, variant: 'ghost' },
                          ]
                        : [{ value: 'ACTIVE', label: t.campaigns.status.ACTIVE, variant: 'primary' }]
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
