'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';

type Application = { id: string; status: string; createdAt: Date } | null;

export function MissionApplyPanel({
  missionId,
  application,
  open,
  authenticated,
}: {
  missionId: string;
  application: Application;
  open: boolean;
  authenticated: boolean;
}) {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const router = useRouter();
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const apply = useMutation({
    mutationFn: () =>
      api.post(`/api/missions/${missionId}/apply`, {
        message: message.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t.volunteer.applied);
      router.refresh();
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof ApiClientError ? mutationError.message : t.errors.genericBody,
      ),
  });

  const withdraw = useMutation({
    mutationFn: () => api.delete(`/api/missions/${missionId}/apply`),
    onSuccess: () => {
      toast.success(t.volunteer.withdraw);
      router.refresh();
    },
  });

  if (!authenticated) {
    return (
      <Button asChild block size="lg">
        <Link href={href('/auth/login')}>
          <Send aria-hidden="true" />
          {t.volunteer.apply}
        </Link>
      </Button>
    );
  }

  if (application && application.status !== 'WITHDRAWN') {
    const tone =
      application.status === 'ACCEPTED'
        ? 'success'
        : application.status === 'REJECTED'
          ? 'danger'
          : 'warning';

    return (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <p className="text-sm font-semibold text-foreground">{t.volunteer.applications}</p>
          <Badge tone={tone}>
            {t.volunteer.applicationStatus[
              application.status as keyof typeof t.volunteer.applicationStatus
            ]}
          </Badge>

          {application.status === 'PENDING' ? (
            <Button
              block
              variant="ghost"
              loading={withdraw.isPending}
              onClick={() => withdraw.mutate()}
            >
              {t.volunteer.withdraw}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        {error ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}

        <Field>
          <FieldLabel optional={t.common.optional}>{t.donations.message}</FieldLabel>
          <Textarea
            rows={4}
            maxLength={1000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </Field>

        <Button
          block
          size="lg"
          disabled={!open}
          loading={apply.isPending}
          onClick={() => apply.mutate()}
        >
          <Send aria-hidden="true" />
          {open ? t.volunteer.apply : t.volunteer.missionStatus.FULL}
        </Button>
      </CardContent>
    </Card>
  );
}
