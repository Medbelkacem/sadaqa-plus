'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, CheckCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { SESSION_QUERY_KEY } from '@/hooks/use-session';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { formatRelative } from '@/i18n/format';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationList() {
  const { t, locale } = useI18n();
  const href = useLocalizedHref();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      api.get<{ items: Notification[]; total: number }>('/api/notifications?pageSize=50'),
  });

  const markAll = useMutation({
    mutationFn: () => api.post('/api/notifications'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });

  const markOne = useMutation({
    mutationFn: (id: string) => api.post(`/api/notifications/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title={t.errors.loadFailed}
        description={t.errors.genericBody}
        action={
          <Button size="sm" onClick={() => refetch()}>
            {t.common.retry}
          </Button>
        }
      />
    );
  }

  const items = data?.items ?? [];
  const unread = items.filter((item) => !item.readAt).length;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={BellOff}
        title={t.empty.notificationsTitle}
        description={t.empty.notificationsBody}
      />
    );
  }

  return (
    <div className="space-y-4">
      {unread > 0 ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck aria-hidden="true" />
            {t.notifications.markAllRead}
          </Button>
        </div>
      ) : null}

      <ul className="space-y-2">
        {items.map((notification) => {
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                <time
                  dateTime={notification.createdAt}
                  className="shrink-0 text-xs text-muted-fg"
                >
                  {formatRelative(notification.createdAt, locale)}
                </time>
              </div>
              {notification.body ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted-fg">{notification.body}</p>
              ) : null}
            </>
          );

          return (
            <li key={notification.id}>
              <div
                className={cn(
                  'relative rounded-[var(--radius-card)] border p-4 transition-colors',
                  notification.readAt
                    ? 'border-border bg-surface'
                    : 'border-primary/25 bg-primary-soft/40',
                )}
              >
                {notification.url ? (
                  <Link
                    href={href(notification.url)}
                    onClick={() => {
                      if (!notification.readAt) markOne.mutate(notification.id);
                    }}
                    className="block after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}

                {!notification.readAt ? (
                  <button
                    type="button"
                    onClick={() => markOne.mutate(notification.id)}
                    className="relative z-10 mt-2 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t.notifications.markRead}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
