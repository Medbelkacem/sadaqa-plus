'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Gavel } from 'lucide-react';
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
import { useI18n } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';

/**
 * Resolves a report.
 *
 * Both outcomes require the moderator to write down what they did — the
 * reporter is told, and the decision is auditable. There is no silent dismiss.
 */
export function ReportDecision({ reportId }: { reportId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<'UNDER_REVIEW' | 'ACTION_TAKEN' | 'DISMISSED'>(
    'ACTION_TAKEN',
  );
  const [resolution, setResolution] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const resolve = useMutation({
    mutationFn: () =>
      api.post(`/api/reports/${reportId}`, {
        status,
        resolution: resolution.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t.admin.decisionRecorded);
      setOpen(false);
      setResolution('');
      router.refresh();
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof ApiClientError ? mutationError.message : t.errors.genericBody,
      ),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="shrink-0">
          <Gavel aria-hidden="true" />
          {t.admin.startReview}
        </Button>
      </DialogTrigger>

      <DialogContent size="sm" closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{t.admin.reports}</DialogTitle>
          <DialogDescription>{t.reports.subtitle}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 pb-4">
          <Field>
            <FieldLabel>{t.reports.status.OPEN}</FieldLabel>
            <Select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as 'UNDER_REVIEW' | 'ACTION_TAKEN' | 'DISMISSED')
              }
            >
              <option value="UNDER_REVIEW">{t.reports.status.UNDER_REVIEW}</option>
              <option value="ACTION_TAKEN">{t.reports.status.ACTION_TAKEN}</option>
              <option value="DISMISSED">{t.reports.status.DISMISSED}</option>
            </Select>
          </Field>

          <Field error={error} hint={t.admin.reasonRequired}>
            <FieldLabel>{t.admin.reasonLabel}</FieldLabel>
            <Textarea
              rows={4}
              maxLength={1000}
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
            />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t.common.cancel}
          </Button>
          <Button
            loading={resolve.isPending}
            disabled={status !== 'UNDER_REVIEW' && !resolution.trim()}
            onClick={() => resolve.mutate()}
          >
            {t.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
