'use client';

import * as React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary.
 *
 * Shows a human sentence, never the thrown message: server errors can contain
 * internal detail, and "500 INTERNAL_SERVER_ERROR" tells a beneficiary
 * nothing. The digest is displayed so a user can quote it to support, and the
 * real error is already in the server log.
 *
 * Strings are inlined rather than read from the dictionary, because the
 * failure this catches may be the very thing that made the locale context
 * unavailable.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[app] route error', { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <div
        className="grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger-soft-fg"
        aria-hidden="true"
      >
        <AlertTriangle className="size-6" />
      </div>

      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Une erreur est survenue</h1>
        <p className="text-sm leading-relaxed text-muted-fg">
          Une erreur est survenue. Veuillez réessayer.
        </p>
      </div>

      <Button onClick={reset}>
        <RotateCw aria-hidden="true" />
        Réessayer
      </Button>

      {error.digest ? (
        <p className="font-mono text-xs text-muted-fg">Référence : {error.digest}</p>
      ) : null}
    </div>
  );
}
