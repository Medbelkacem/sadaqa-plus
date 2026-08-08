'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';

type Option = {
  value: string;
  label: string;
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
};

/**
 * Generic status-transition buttons.
 *
 * The caller supplies only the transitions that are legal from the current
 * status; the server's state machine is still the authority and will reject
 * anything else with INVALID_STATE_TRANSITION.
 */
export function StatusActions({
  endpoint,
  current,
  options,
}: {
  endpoint: string;
  current: string;
  options: Option[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  const change = useMutation({
    mutationFn: (status: string) => api.post(endpoint, { status }),
    onMutate: (status) => setPending(status),
    onSuccess: () => {
      toast.success(t.admin.decisionRecorded);
      router.refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : t.errors.genericBody),
    onSettled: () => setPending(null),
  });

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      {options
        .filter((option) => option.value !== current)
        .map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={option.variant}
            loading={pending === option.value}
            onClick={() => change.mutate(option.value)}
          >
            {option.label}
          </Button>
        ))}
    </div>
  );
}
