import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ConversationThread } from '@/features/messaging/conversation-thread';
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

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { t, href } = await resolveLocale(params as Promise<{ locale: string }>);
  const { id } = await params;

  const auth = await getAuthContext();
  if (!auth) {
    redirect(`${href('/auth/login')}?next=${encodeURIComponent(href(`/messages/${id}`))}`);
  }

  // Membership is enforced by the API the thread reads from; a non-member sees
  // the same 404 shape as a conversation that does not exist.
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-fg">
        <Link href={href('/messages')} className="underline-offset-4 hover:underline">
          {t.messages.title}
        </Link>
      </nav>

      <ConversationThread conversationId={id} currentUserId={auth.user.id} />
    </div>
  );
}
