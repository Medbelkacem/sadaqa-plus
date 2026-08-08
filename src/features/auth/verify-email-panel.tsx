'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SESSION_QUERY_KEY } from '@/hooks/use-session';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { api } from '@/lib/api/client';

type State = 'verifying' | 'success' | 'failed';

export function VerifyEmailPanel() {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const token = searchParams.get('token');
  const [state, setState] = React.useState<State>(token ? 'verifying' : 'failed');
  const started = React.useRef(false);

  React.useEffect(() => {
    if (!token || started.current) return;
    // Verification consumes the token; React 18 double-invokes effects in dev,
    // which would burn it on the first render and fail on the second.
    started.current = true;

    api
      .post('/api/auth/verify-email', { token })
      .then(async () => {
        setState('success');
        await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      })
      .catch(() => setState('failed'));
  }, [token, queryClient]);

  if (state === 'verifying') {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center" aria-busy="true">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-fg">{t.auth.verifying}</p>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-foreground">{t.auth.verifyEmailSuccess}</p>
        <Button asChild block>
          <Link href={href('/dashboard')}>{t.nav.dashboard}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <XCircle className="size-10 text-danger" aria-hidden="true" />
      <p className="text-sm leading-relaxed text-foreground">{t.auth.verifyEmailFailed}</p>
      <Button asChild variant="secondary" block>
        <Link href={href('/auth/login')}>{t.nav.login}</Link>
      </Button>
    </div>
  );
}
