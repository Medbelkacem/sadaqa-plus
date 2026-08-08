'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import { useI18n } from '@/i18n/context';
import { formatDateTime } from '@/i18n/format';
import { ApiClientError, api } from '@/lib/api/client';
import { cn } from '@/lib/utils';

type Message = {
  id: string;
  body: string;
  senderId: string;
  isHidden: boolean;
  createdAt: string;
  attachments: { id: string; file: { id: string; originalName: string; mimeType: string } }[];
};

type ThreadPayload = {
  conversation: {
    id: string;
    subject: string | null;
    isLocked: boolean;
    members: {
      user: {
        id: string;
        profile: { firstName: string; lastName: string; avatarId: string | null } | null;
      };
    }[];
  } | null;
  messages: { items: Message[] };
};

export function ConversationThread({
  conversationId,
  currentUserId,
}: {
  conversationId: string;
  currentUserId: string;
}) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [body, setBody] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => api.get<ThreadPayload>(`/api/messages/${conversationId}`),
    refetchInterval: 20_000,
  });

  const send = useMutation({
    mutationFn: () => api.post(`/api/messages/${conversationId}`, { body: body.trim() }),
    onSuccess: () => {
      setBody('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof ApiClientError ? mutationError.message : t.errors.genericBody,
      ),
  });

  // The API returns newest-first for pagination; the thread reads oldest-first.
  const messages = React.useMemo(
    () => [...(data?.messages.items ?? [])].reverse(),
    [data?.messages.items],
  );

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  if (isLoading) {
    return <div className="h-96 rounded-[var(--radius-card)] bg-surface-sunken" aria-hidden="true" />;
  }

  const conversation = data?.conversation;
  const other = conversation?.members.find((member) => member.user.id !== currentUserId)?.user;
  const otherName = other?.profile
    ? `${other.profile.firstName} ${other.profile.lastName}`
    : t.common.anonymous;

  return (
    <div className="flex h-[calc(100dvh-16rem)] flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      <header className="flex items-center gap-3 border-b border-border p-4">
        <Avatar
          name={otherName}
          src={other?.profile?.avatarId ? `/api/files/${other.profile.avatarId}` : null}
          size={40}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{otherName}</p>
          {conversation?.subject ? (
            <p className="truncate text-xs text-muted-fg">{conversation.subject}</p>
          ) : null}
        </div>
      </header>

      <div className="scrollbar-slim flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => {
          const mine = message.senderId === currentUserId;

          if (message.isHidden) {
            return (
              <p
                key={message.id}
                className="mx-auto max-w-sm rounded-lg bg-surface-muted px-3 py-2 text-center text-xs italic text-muted-fg"
              >
                {t.messages.locked}
              </p>
            );
          }

          return (
            <div
              key={message.id}
              className={cn('flex', mine ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-3.5 py-2.5',
                  mine
                    ? 'rounded-ee-sm bg-primary text-primary-fg'
                    : 'rounded-es-sm bg-surface-muted text-foreground',
                )}
              >
                <p className="whitespace-pre-line break-words text-sm leading-relaxed">
                  {message.body}
                </p>

                {message.attachments.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {message.attachments.map((attachment) => (
                      <li key={attachment.id}>
                        <a
                          href={`/api/files/${attachment.file.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline underline-offset-2"
                        >
                          {attachment.file.originalName}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <time
                  dateTime={message.createdAt}
                  className={cn(
                    'mt-1 block text-[11px]',
                    mine ? 'text-primary-fg/70' : 'text-muted-fg',
                  )}
                >
                  {formatDateTime(message.createdAt, locale)}
                </time>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3">
        {conversation?.isLocked ? (
          <Alert tone="warning">{t.messages.locked}</Alert>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (body.trim()) send.mutate();
            }}
            className="flex items-end gap-2"
          >
            <Textarea
              rows={2}
              value={body}
              maxLength={4000}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter breaks the line — the convention
                // people already expect from every messaging app.
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (body.trim()) send.mutate();
                }
              }}
              placeholder={t.messages.writeMessage}
              aria-label={t.messages.writeMessage}
              className="min-h-11 resize-none"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!body.trim()}
              loading={send.isPending}
              aria-label={t.messages.send}
            >
              <Send className="rtl:rotate-180" aria-hidden="true" />
            </Button>
          </form>
        )}

        {error ? (
          <p role="alert" className="mt-2 text-xs font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
