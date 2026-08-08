'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MessagesSquare } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/misc';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { formatRelative } from '@/i18n/format';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';

type Conversation = {
  id: string;
  subject: string | null;
  lastMessageAt: string | null;
  unread: number;
  members: {
    user: {
      id: string;
      profile: { firstName: string; lastName: string; avatarId: string | null } | null;
    };
  }[];
  messages: { body: string; createdAt: string; senderId: string }[];
};

export function ConversationList() {
  const { t, locale } = useI18n();
  const href = useLocalizedHref();

  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<{ items: Conversation[] }>('/api/messages?pageSize=30'),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title={t.empty.messagesTitle}
        description={t.empty.messagesBody}
      />
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
      {items.map((conversation) => {
        const other = conversation.members[0]?.user;
        const name = other?.profile
          ? `${other.profile.firstName} ${other.profile.lastName}`
          : t.common.anonymous;
        const preview = conversation.messages[0];

        return (
          <li key={conversation.id}>
            <Link
              href={href(`/messages/${conversation.id}`)}
              className={cn(
                'flex items-center gap-3 p-4 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                conversation.unread > 0 && 'bg-primary-soft/30',
              )}
            >
              <Avatar
                name={name}
                src={other?.profile?.avatarId ? `/api/files/${other.profile.avatarId}` : null}
                size={44}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                  {conversation.lastMessageAt ? (
                    <time
                      dateTime={conversation.lastMessageAt}
                      className="shrink-0 text-xs text-muted-fg"
                    >
                      {formatRelative(conversation.lastMessageAt, locale)}
                    </time>
                  ) : null}
                </div>

                {conversation.subject ? (
                  <p className="truncate text-xs text-muted-fg">{conversation.subject}</p>
                ) : null}

                {preview ? (
                  <p className="mt-0.5 truncate text-sm text-muted-fg">{preview.body}</p>
                ) : null}
              </div>

              {conversation.unread > 0 ? (
                <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-fg">
                  {conversation.unread}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
