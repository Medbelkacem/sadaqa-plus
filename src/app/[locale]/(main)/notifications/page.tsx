import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { NotificationList } from '@/features/notifications/notification-list';
import { NotificationPreferences } from '@/features/notifications/notification-preferences';
import { resolveLocale } from '@/i18n/server';
import { getAuthContext } from '@/server/auth/context';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.notifications.title, robots: { index: false, follow: false } };
}

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { t, href } = await resolveLocale(params);

  const auth = await getAuthContext();
  if (!auth) {
    redirect(`${href('/auth/login')}?next=${encodeURIComponent(href('/notifications'))}`);
  }

  return (
    <>
      <PageHeader title={t.notifications.title} />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <NotificationList />
          <NotificationPreferences />
        </div>
      </div>
    </>
  );
}
