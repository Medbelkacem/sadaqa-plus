'use client';

import * as React from 'react';

import { useOptionalI18n } from '@/i18n/context';
import { cn } from '@/lib/utils';

/**
 * Sadaqa+ mark — two hands cupped into a heart around a crescent.
 *
 * Drawn as inline SVG rather than an image file so it inherits `currentColor`,
 * stays crisp at every size, needs no extra request, and works inside the
 * strict CSP. The gradient id is namespaced per instance to avoid collisions
 * when several marks render on one page.
 */
export function LogoMark({
  className,
  monochrome = false,
  title,
}: {
  className?: string;
  monochrome?: boolean;
  title?: string;
}) {
  const gradientId = React.useId();

  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('size-8', className)}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
    >
      {!monochrome && (
        <defs>
          <linearGradient id={gradientId} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#16A34A" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>
        </defs>
      )}

      {/* Left hand / heart lobe */}
      <path
        d="M24 41.2 9.6 27.6a8.9 8.9 0 0 1-.5-12.3 8.4 8.4 0 0 1 12.2-.3L24 17.5"
        stroke={monochrome ? 'currentColor' : `url(#${gradientId})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right hand / heart lobe */}
      <path
        d="M24 41.2l14.4-13.6a8.9 8.9 0 0 0 .5-12.3 8.4 8.4 0 0 0-12.2-.3L24 17.5"
        stroke={monochrome ? 'currentColor' : `url(#${gradientId})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Crescent held between the hands */}
      <path
        d="M28.4 24.3a5.9 5.9 0 1 1-5.2-8.2 4.8 4.8 0 1 0 5.2 8.2Z"
        fill={monochrome ? 'currentColor' : `url(#${gradientId})`}
      />
    </svg>
  );
}

/**
 * Full lock-up: mark plus wordmark.
 *
 * The wordmark is the Arabic form in Arabic and the Latin form elsewhere, and
 * each is wrapped in its own direction. Without that, bidi reordering renders
 * the Latin wordmark as "+Sadaqa" on an RTL page — the `+` is neutral, so it
 * takes the paragraph direction rather than the word's.
 */
export function Logo({
  className,
  compact = false,
  monochrome = false,
}: {
  className?: string;
  compact?: boolean;
  monochrome?: boolean;
}) {
  const i18n = useOptionalI18n();
  const isArabic = i18n?.locale === 'ar';
  const name = isArabic ? 'صدقة' : 'Sadaqa';

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark monochrome={monochrome} title={isArabic ? 'صدقة+' : 'Sadaqa+'} />
      {!compact && (
        <span
          dir={isArabic ? 'rtl' : 'ltr'}
          className="text-lg font-bold tracking-tight text-foreground"
        >
          {name}
          <span className={monochrome ? 'text-foreground' : 'text-primary'}>+</span>
        </span>
      )}
    </span>
  );
}
