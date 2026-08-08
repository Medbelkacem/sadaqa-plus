import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { ConversationList } from '@/features/messaging/conversation-list';
import { resolveLocale } from '@/i18n/server';
import { getAuthContext } from '@/server/auth/context';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.messages.title, robots: { index: false, follow: false } };
}

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { t, href } = await resolveLocale(params);

  const auth = await getAuthContext();
  if (!auth) {
    redirect(`${href('/auth/login')}?next=${encodeURIComponent(href('/messages'))}`);
  }

  return (
    <>
      <PageHeader title={t.messages.title} />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <ConversationList />
      </div>
    </>
  );
}
