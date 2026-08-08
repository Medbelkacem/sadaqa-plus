'use client';

import * as React from 'react';
import { Check, Facebook, Link2, MessageCircle, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useHydrated } from '@/hooks/use-hydrated';
import { useI18n } from '@/i18n/context';

/**
 * Share controls.
 *
 * Prefers the native share sheet when the device offers one (the norm on
 * mobile in Algeria), and falls back to explicit WhatsApp / Facebook / X links
 * plus copy-to-clipboard. Nothing is loaded from the social networks
 * themselves, so no third-party script sees the visitor.
 */
export function ShareRow({ title, path }: { title: string; path: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = React.useState(false);

  // The absolute URL and the availability of the native share sheet are both
  // browser-only facts, so they are derived after hydration rather than
  // written into state from an effect.
  const hydrated = useHydrated();
  const url = hydrated ? new URL(path, window.location.origin).toString() : '';
  const canNativeShare = hydrated && typeof navigator.share === 'function';

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the URL is visible in the address bar.
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // The user dismissed the sheet — not an error worth reporting.
    }
  }

  if (!url) return null;

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="space-y-2">
      {canNativeShare ? (
        <Button variant="secondary" block onClick={nativeShare}>
          <Share2 aria-hidden="true" />
          {t.common.share}
        </Button>
      ) : null}

      <div className="flex gap-2">
        <Button variant="outline" size="icon" onClick={copy} aria-label={t.common.copyLink}>
          {copied ? (
            <Check className="text-success" aria-hidden="true" />
          ) : (
            <Link2 aria-hidden="true" />
          )}
        </Button>

        <Button asChild variant="outline" size="icon">
          <a
            href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
          >
            <MessageCircle aria-hidden="true" />
          </a>
        </Button>

        <Button asChild variant="outline" size="icon">
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
          >
            <Facebook aria-hidden="true" />
          </a>
        </Button>

        <Button asChild variant="outline" size="icon">
          <a
            href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
              <path d="M18.9 2H22l-7.1 8.1L23.2 22h-6.6l-5.2-6.8L5.5 22H2.4l7.6-8.7L1.2 2h6.8l4.7 6.2L18.9 2Zm-1.1 18h1.8L7.3 3.9H5.4L17.8 20Z" />
            </svg>
          </a>
        </Button>
      </div>

      <span aria-live="polite" className="sr-only">
        {copied ? t.common.linkCopied : ''}
      </span>
    </div>
  );
}
