'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Eye, XCircle } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { useI18n } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';

/**
 * Partnership decision controls.
 *
 * Approval creates a real, publicly listed organization, so it is behind a
 * confirmation dialog rather than a single click. Rejection requires a reason,
 * which the applicant receives verbatim.
 */
export function ApplicationDecision({
  applicationId,
  status,
}: {
  applicationId: string;
  status: 'PENDING' | 'UNDER_REVIEW';
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [dialog, setDialog] = React.useState<'APPROVED' | 'REJECTED' | null>(null);
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const decide = useMutation({
    mutationFn: (decision: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED') =>
      api.post(`/api/organizations/applications/${applicationId}`, {
        decision,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t.admin.decisionRecorded);
      setDialog(null);
      setReason('');
      router.refresh();
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof ApiClientError ? mutationError.message : t.errors.genericBody,
      ),
  });

  return (
    <>
      <div className="flex shrink-0 flex-wrap gap-2">
        {status === 'PENDING' ? (
          <Button
            size="sm"
            variant="secondary"
            loading={decide.isPending && !dialog}
            onClick={() => decide.mutate('UNDER_REVIEW')}
          >
            <Eye aria-hidden="true" />
            {t.admin.startReview}
          </Button>
        ) : null}

        <Button size="sm" onClick={() => setDialog('APPROVED')}>
          <CheckCircle2 aria-hidden="true" />
          {t.admin.approve}
        </Button>

        <Button size="sm" variant="danger" onClick={() => setDialog('REJECTED')}>
          <XCircle aria-hidden="true" />
          {t.admin.reject}
        </Button>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent size="sm" closeLabel={t.common.close}>
          <DialogHeader>
            <DialogTitle>
              {dialog === 'APPROVED' ? t.admin.approve : t.admin.reject}
            </DialogTitle>
            <DialogDescription>
              {dialog === 'APPROVED'
                ? t.organizations.applicationSubmittedBody
                : t.admin.reasonRequired}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="pb-4">
            <Field error={error}>
              <FieldLabel optional={dialog === 'APPROVED' ? t.common.optional : undefined}>
                {t.admin.reasonLabel}
              </FieldLabel>
              <Textarea
                rows={4}
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant={dialog === 'REJECTED' ? 'danger' : 'primary'}
              disabled={dialog === 'REJECTED' && !reason.trim()}
              loading={decide.isPending}
              onClick={() => dialog && decide.mutate(dialog)}
            >
              {t.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
