'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Archive, CheckCircle2, Eye, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { useI18n } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';
import { REQUEST_TRANSITIONS } from '@/server/domain/request-workflow';

type Action = 'start_review' | 'verify' | 'publish' | 'reject' | 'archive' | 'expire';

const ACTION_TARGET: Record<Action, string> = {
  start_review: 'UNDER_REVIEW',
  verify: 'VERIFIED',
  publish: 'ACTIVE',
  reject: 'REJECTED',
  archive: 'ARCHIVED',
  expire: 'EXPIRED',
};

/**
 * Moderator decision panel.
 *
 * Only actions that the state machine actually permits from the current status
 * are offered — the same table the server enforces, so the UI cannot suggest a
 * move that will be rejected. Rejection requires a reason, in the UI and again
 * on the server.
 */
export function ModerationPanel({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<Action | null>(null);

  const allowed = REQUEST_TRANSITIONS[status as keyof typeof REQUEST_TRANSITIONS] ?? [];

  const ALL_ACTIONS = [
    { action: 'start_review', label: t.admin.startReview, icon: Eye, variant: 'secondary' },
    { action: 'verify', label: t.admin.approve, icon: CheckCircle2, variant: 'primary' },
    { action: 'publish', label: t.common.published, icon: Send, variant: 'primary' },
    { action: 'reject', label: t.admin.reject, icon: XCircle, variant: 'danger' },
    { action: 'archive', label: t.requests.status.ARCHIVED, icon: Archive, variant: 'ghost' },
  ] as const satisfies readonly {
    action: Action;
    label: string;
    icon: typeof Eye;
    variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  }[];

  const actions = ALL_ACTIONS.filter((entry) =>
    allowed.includes(ACTION_TARGET[entry.action] as never),
  );

  const moderate = useMutation({
    mutationFn: (action: Action) =>
      api.post(`/api/requests/${requestId}/moderate`, {
        action,
        reason: reason.trim() || undefined,
      }),
    onMutate: (action) => {
      setPending(action);
      setError(null);
    },
    onSuccess: () => {
      toast.success(t.admin.decisionRecorded);
      setReason('');
      router.refresh();
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiClientError ? mutationError.message : t.errors.genericBody,
      );
    },
    onSettled: () => setPending(null),
  });

  if (actions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm text-muted-fg">{t.requests.status[status as 'ARCHIVED']}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
          {t.admin.moderationQueue}
        </h2>

        {error ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}

        <Field hint={t.admin.reasonRequired}>
          <FieldLabel optional={t.common.optional}>{t.admin.reasonLabel}</FieldLabel>
          <Textarea
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>

        <div className="flex flex-col gap-2">
          {actions.map((entry) => (
            <Button
              key={entry.action}
              block
              variant={entry.variant}
              loading={pending === entry.action}
              disabled={entry.action === 'reject' && !reason.trim()}
              onClick={() => moderate.mutate(entry.action)}
            >
              <entry.icon aria-hidden="true" />
              {entry.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
