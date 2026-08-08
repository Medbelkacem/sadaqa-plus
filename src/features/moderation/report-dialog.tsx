'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, Textarea } from '@/components/ui/input';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';

const REASONS = [
  'FRAUD',
  'DUPLICATE',
  'INAPPROPRIATE',
  'MISLEADING',
  'HARASSMENT',
  'PRIVACY',
  'OTHER',
] as const;

export function ReportDialog({
  targetType,
  targetId,
  authenticated,
}: {
  targetType: 'REQUEST' | 'CAMPAIGN' | 'EVENT' | 'ORGANIZATION' | 'USER' | 'MESSAGE';
  targetId: string;
  authenticated: boolean;
}) {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<(typeof REASONS)[number]>('FRAUD');
  const [description, setDescription] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api.post('/api/reports', {
        targetType,
        targetId,
        reason,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      setOpen(false);
      setDescription('');
      toast.success(t.reports.submitted);
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiClientError ? mutationError.message : t.errors.genericBody,
      );
    },
  });

  if (!authenticated) {
    return (
      <Button asChild variant="ghost" block size="sm">
        <Link href={href('/auth/login')}>
          <Flag aria-hidden="true" />
          {t.common.report}
        </Link>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" block size="sm">
          <Flag aria-hidden="true" />
          {t.common.report}
        </Button>
      </DialogTrigger>

      <DialogContent size="sm" closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{t.reports.title}</DialogTitle>
          <DialogDescription>{t.reports.subtitle}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 pb-4">
          <Field>
            <FieldLabel>{t.reports.reason}</FieldLabel>
            <Select
              value={reason}
              onChange={(event) => setReason(event.target.value as (typeof REASONS)[number])}
            >
              {REASONS.map((value) => (
                <option key={value} value={value}>
                  {t.reports.reasons[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field error={error}>
            <FieldLabel optional={t.common.optional}>{t.reports.description}</FieldLabel>
            <Textarea
              rows={4}
              value={description}
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t.common.cancel}
          </Button>
          <Button loading={submit.isPending} onClick={() => submit.mutate()}>
            {t.common.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
