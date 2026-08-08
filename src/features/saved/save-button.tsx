'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { api } from '@/lib/api/client';

type SavedTarget = 'REQUEST' | 'CAMPAIGN' | 'EVENT';

/**
 * Bookmark toggle.
 *
 * Anonymous visitors get a link to sign in rather than a button that fails —
 * the action is honest about needing an account before it is pressed.
 */
export function SaveButton({
  targetType,
  targetId,
  authenticated,
}: {
  targetType: SavedTarget;
  targetId: string;
  authenticated: boolean;
}) {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['saved', targetType, targetId],
    queryFn: async () => {
      const result = await api.get<{
        items: { targetType: string; item: { id: string } | null }[];
      }>('/api/saved?pageSize=50');
      return result.items.some(
        (entry) => entry.targetType === targetType && entry.item?.id === targetId,
      );
    },
    enabled: authenticated,
    staleTime: 60_000,
  });

  const toggle = useMutation({
    mutationFn: () => api.post<{ saved: boolean }>('/api/saved', { targetType, targetId }),
    onSuccess: (result) => {
      queryClient.setQueryData(['saved', targetType, targetId], result.saved);
      void queryClient.invalidateQueries({ queryKey: ['saved-list'] });
    },
  });

  if (!authenticated) {
    return (
      <Button asChild variant="outline" block>
        <Link href={href('/auth/login')}>
          <Bookmark aria-hidden="true" />
          {t.common.save_item}
        </Link>
      </Button>
    );
  }

  const saved = Boolean(data);

  return (
    <Button
      variant={saved ? 'secondary' : 'outline'}
      block
      loading={toggle.isPending}
      onClick={() => toggle.mutate()}
      aria-pressed={saved}
    >
      {saved ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
      {saved ? t.common.saved : t.common.save_item}
    </Button>
  );
}
