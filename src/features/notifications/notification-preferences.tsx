'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/misc';
import { useI18n } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';

type PreferencePayload = {
  preference: {
    inAppEnabled: boolean;
    emailEnabled: boolean;
    pushEnabled: boolean;
    urgentNearby: boolean;
    mutedTypes: string[];
  };
  channels: { push: boolean; email: boolean };
};

/**
 * Notification channel preferences.
 *
 * Channels the deployment cannot actually deliver are shown disabled with an
 * explanation, rather than as working toggles that quietly do nothing.
 */
export function NotificationPreferences() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => api.get<PreferencePayload>('/api/notifications/preferences'),
  });

  const [pushBusy, setPushBusy] = React.useState(false);

  const save = useMutation({
    mutationFn: (next: PreferencePayload['preference']) =>
      api.put('/api/notifications/preferences', next),
    onSuccess: () => {
      toast.success(t.common.saved);
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : t.errors.genericBody),
  });

  if (isLoading || !data) {
    return <div className="h-48 rounded-[var(--radius-card)] bg-surface-sunken" aria-hidden="true" />;
  }

  const { preference, channels } = data;

  function update(patch: Partial<PreferencePayload['preference']>) {
    save.mutate({ ...preference, ...patch });
  }

  /**
   * Enabling push needs three things to line up: server VAPID keys, a service
   * worker registration and the browser permission. Each failure is reported
   * distinctly instead of a generic error.
   */
  async function enablePush() {
    if (!channels.push) return;
    setPushBusy(true);

    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        toast.error(t.notifications.pushNotConfigured);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error(t.notifications.pushBlocked);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_PUSH_PUBLIC_KEY;
      if (!publicKey) {
        toast.error(t.notifications.pushNotConfigured);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await api.post('/api/push/subscribe', subscription.toJSON());
      toast.success(t.notifications.pushEnabled);
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : t.errors.genericBody);
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.delete(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`);
        await subscription.unsubscribe();
      } else {
        await api.delete('/api/push/subscribe');
      }
      toast.success(t.notifications.pushDisabled);
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">{t.notifications.preferences}</h2>

      <Card className="mt-4">
        <CardContent className="space-y-5 pt-6">
          <Row
            label={t.notifications.inApp}
            checked={preference.inAppEnabled}
            onChange={(value) => update({ inAppEnabled: value })}
          />

          <Row
            label={t.notifications.email}
            checked={preference.emailEnabled}
            disabled={!channels.email}
            hint={!channels.email ? t.errors.serviceNotConfigured : undefined}
            onChange={(value) => update({ emailEnabled: value })}
          />

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-foreground">{t.notifications.push}</p>
              {!channels.push ? (
                <p className="mt-1 text-xs text-muted-fg">
                  {t.notifications.pushNotConfigured}
                </p>
              ) : null}
            </div>
            <Button
              size="sm"
              variant={preference.pushEnabled ? 'secondary' : 'primary'}
              disabled={!channels.push}
              loading={pushBusy}
              onClick={() => (preference.pushEnabled ? disablePush() : enablePush())}
            >
              {preference.pushEnabled ? t.common.delete : t.notifications.pushEnable}
            </Button>
          </div>

          <Row
            label={t.notifications.urgentNearby}
            checked={preference.urgentNearby}
            onChange={(value) => update({ urgentNearby: value })}
          />
        </CardContent>
      </Card>

      {!channels.email ? (
        <Alert tone="neutral" className="mt-4">
          {t.errors.serviceNotConfigured}
        </Alert>
      ) : null}
    </section>
  );
}

function Row({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const id = React.useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="text-sm text-foreground">
        {label}
        {hint ? <span className="mt-1 block text-xs text-muted-fg">{hint}</span> : null}
      </label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

/** VAPID keys are base64url; the Push API wants raw bytes. */
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
