'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { CalendarCheck, QrCode } from 'lucide-react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';

import { TicketQr } from './ticket-qr';

type Registration = {
  id: string;
  status: string;
  kind: string;
  ticketCode: string;
  checkedInAt: Date | null;
} | null;

export function EventRegistration({
  eventId,
  registration,
  full,
  authenticated,
  past,
}: {
  eventId: string;
  registration: Registration;
  full: boolean;
  authenticated: boolean;
  /**
   * Whether the event has already started. Computed on the server so the
   * render is deterministic — reading the clock during render would make the
   * output depend on when React happened to run.
   */
  past: boolean;
}) {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  const register = useMutation({
    mutationFn: () => api.post('/api/events/' + eventId + '/register', { kind: 'PARTICIPANT' }),
    onSuccess: () => {
      toast.success(t.events.registered);
      router.refresh();
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiClientError ? mutationError.message : t.errors.genericBody,
      );
    },
  });

  const cancel = useMutation({
    mutationFn: () => api.delete('/api/events/' + eventId + '/register'),
    onSuccess: () => {
      toast.success(t.events.cancelRegistration);
      router.refresh();
    },
  });

  if (!authenticated) {
    return (
      <Button asChild block size="lg">
        <Link href={href('/auth/login')}>
          <CalendarCheck aria-hidden="true" />
          {t.events.register}
        </Link>
      </Button>
    );
  }

  if (registration && registration.status !== 'CANCELLED') {
    return (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <p className="text-sm font-semibold text-foreground">
            {registration.status === 'WAITLISTED' ? t.events.full : t.events.registered}
          </p>

          {registration.checkedInAt ? (
            <Alert tone="success">{t.events.checkedIn}</Alert>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button block variant="secondary">
                  <QrCode aria-hidden="true" />
                  {t.events.myTicket}
                </Button>
              </DialogTrigger>
              <DialogContent size="sm" closeLabel={t.common.close}>
                <DialogHeader>
                  <DialogTitle>{t.events.myTicket}</DialogTitle>
                </DialogHeader>
                <DialogBody className="pb-6">
                  <TicketQr code={registration.ticketCode} hint={t.events.ticketHint} />
                </DialogBody>
              </DialogContent>
            </Dialog>
          )}

          {!past ? (
            <Button
              block
              variant="ghost"
              loading={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {t.events.cancelRegistration}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      ) : null}
      <Button
        block
        size="lg"
        disabled={past}
        loading={register.isPending}
        onClick={() => register.mutate()}
      >
        <CalendarCheck aria-hidden="true" />
        {full ? t.events.full : t.events.register}
      </Button>
      {full ? <p className="text-center text-xs text-muted-fg">{t.events.full}</p> : null}
    </div>
  );
}
