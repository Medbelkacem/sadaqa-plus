'use client';

import * as React from 'react';
import QRCode from 'qrcode';

/**
 * Renders the participation code as a QR.
 *
 * Generated in the browser from the code the server already issued — the
 * image is never uploaded or fetched, so the code does not travel anywhere it
 * has not already been. The code itself is also shown as text, because
 * scanners fail and a human at the door can type it.
 */
export function TicketQr({ code, hint }: { code: string; hint: string }) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(code, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {/* A data: URI generated in this component — there is nothing for the
          image optimizer to fetch or resize. */}
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt=""
          width={240}
          height={240}
          className="rounded-xl border border-border bg-white p-2"
        />
      ) : (
        <div
          className="size-60 animate-pulse rounded-xl bg-surface-sunken"
          aria-hidden="true"
        />
      )}

      {failed ? (
        <p className="text-xs text-danger">QR indisponible — utilisez le code ci-dessous.</p>
      ) : null}

      <p className="select-all break-all rounded-lg bg-surface-muted px-3 py-2 font-mono text-xs text-foreground">
        {code}
      </p>

      <p className="text-xs leading-relaxed text-muted-fg">{hint}</p>
    </div>
  );
}
