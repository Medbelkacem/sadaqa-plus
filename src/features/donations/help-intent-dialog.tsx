'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { HandHeart } from 'lucide-react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
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
import { Input, Textarea } from '@/components/ui/input';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';

/**
 * "Je veux aider" — declares an intent, not a payment.
 *
 * The copy is explicit that this is an offer of help which the organisation
 * will follow up on. Nothing here touches money, and the resulting record is
 * never counted in any collected total.
 */
export function HelpIntentDialog({
  targetType,
  targetId,
  title,
  authenticated,
}: {
  targetType: 'REQUEST' | 'CAMPAIGN';
  targetId: string;
  title: string;
  authenticated: boolean;
}) {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [quantity, setQuantity] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api.post('/api/donations/intents', {
        [targetType === 'REQUEST' ? 'requestId' : 'campaignId']: targetId,
        kind: 'MATERIAL',
        quantity: quantity ? Number(quantity) : undefined,
        message: message.trim() || undefined,
      }),
    onSuccess: () => {
      setOpen(false);
      setMessage('');
      setQuantity('');
      toast.success(t.donations.intentSubmitted);
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiClientError ? mutationError.message : t.errors.genericBody,
      );
    },
  });

  if (!authenticated) {
    return (
      <Button asChild block size="lg">
        <Link href={href(`/auth/login?next=${encodeURIComponent(`/requests`)}`)}>
          <HandHeart aria-hidden="true" />
          {t.requests.helpCta}
        </Link>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button block size="lg">
          <HandHeart aria-hidden="true" />
          {t.requests.helpCta}
        </Button>
      </DialogTrigger>

      <DialogContent size="sm" closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{t.donations.intentTitle}</DialogTitle>
          <DialogDescription>{t.donations.intentSubtitle}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 pb-4">
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm font-medium text-foreground">
            {title}
          </p>

          {/* Says plainly that this is not a payment. */}
          <Alert tone="info" title={t.donations.intentVsConfirmed}>
            {t.donations.paymentNotConfiguredBody}
          </Alert>

          <Field>
            <FieldLabel optional={t.common.optional}>{t.donations.quantityOffered}</FieldLabel>
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>

          <Field error={error}>
            <FieldLabel>{t.donations.message}</FieldLabel>
            <Textarea
              rows={4}
              maxLength={1000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
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
