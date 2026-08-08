'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { CreditCard, Info } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';

/**
 * Monetary donation entry point.
 *
 * When no payment provider is configured, this renders an honest
 * "not configured" panel. It does NOT render a payment form that would fail,
 * and there is no client-side path that could mark a donation as received.
 */
export function DonateCard({
  campaignId,
  configured,
  authenticated,
}: {
  campaignId: string;
  configured: boolean;
  authenticated: boolean;
}) {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const [amount, setAmount] = React.useState('');
  const [anonymous, setAnonymous] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const checkout = useMutation({
    mutationFn: () =>
      api.post<{ redirectUrl: string }>('/api/donations/checkout', {
        campaignId,
        amount: Number(amount),
        isAnonymous: anonymous,
      }),
    onSuccess: (result) => {
      window.location.href = result.redirectUrl;
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiClientError ? mutationError.message : t.errors.genericBody,
      );
    },
  });

  if (!configured) {
    return (
      <Card>
        <CardContent className="pt-5">
          <Alert tone="neutral" icon={Info} title={t.donations.paymentNotConfigured}>
            {t.donations.paymentNotConfiguredBody}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!authenticated) {
    return (
      <Button asChild block size="lg">
        <Link href={href('/auth/login')}>
          <CreditCard aria-hidden="true" />
          {t.campaigns.supportCta}
        </Link>
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <Field error={error}>
          <FieldLabel>{t.donations.amount}</FieldLabel>
          <Input
            type="number"
            min={1}
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="1000"
          />
        </Field>

        <div className="flex items-start gap-2.5">
          <Checkbox
            id="anonymous"
            checked={anonymous}
            onCheckedChange={(checked) => setAnonymous(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor="anonymous" className="text-sm text-muted-fg">
            {t.common.anonymous}
          </label>
        </div>

        <Button
          block
          size="lg"
          disabled={!amount || Number(amount) <= 0}
          loading={checkout.isPending}
          onClick={() => checkout.mutate()}
        >
          <CreditCard aria-hidden="true" />
          {t.campaigns.supportCta}
        </Button>

        <p className="text-xs leading-relaxed text-muted-fg">{t.donations.noTaxClaim}</p>
      </CardContent>
    </Card>
  );
}
