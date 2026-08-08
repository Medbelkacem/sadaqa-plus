'use client';

import * as React from 'react';

import { useOptionalI18n } from '@/i18n/context';
import { cn } from '@/lib/utils';

/**
 * Sadaqa+ symbol.
 *
 * Two crossing bars: the green one gives, the amber one receives. Their
 * intersection is the third colour — what the meeting produces. It is also
 * the "+" of Sadaqa+.
 *
 * Drawn as inline SVG rather than an image so it inherits the theme, stays
 * crisp at every size, costs no extra request, and needs no CSP exception.
 */

/** Brand palette, from the identity spec. */
const BRAND = {
  deep: '#05372A', // Vert profond
  green: '#00795A', // Vert Sadaqa
  light: '#3FCF9B', // Vert clair
  amber: '#E8A33D', // Ambre
  cream: '#FBF8F2', // Crème
} as const;

export type LogoVariant =
  /** Green + amber on a light ground. */
  | 'default'
  /** Light green + amber, for a dark or deep-green ground. */
  | 'onDark'
  /** Single-colour, for stamps, fax and one-colour print. */
  | 'monochrome'
  /** White vertical bar + amber, as inside the app-icon tile. */
  | 'onBrand';

export function LogoMark({
  className,
  variant = 'default',
  title,
}: {
  className?: string;
  variant?: LogoVariant;
  title?: string;
}) {
  const vertical =
    variant === 'monochrome'
      ? 'currentColor'
      : variant === 'onDark'
        ? BRAND.light
        : variant === 'onBrand'
          ? '#FFFFFF'
          : BRAND.green;

  const horizontal = variant === 'monochrome' ? 'currentColor' : BRAND.amber;

  // The crossing square is the point of the mark, so it is drawn explicitly
  // rather than relying on a blend mode that print and email would drop.
  const intersection = variant === 'monochrome' ? '#FFFFFF' : BRAND.deep;

  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('size-8 shrink-0', className)}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* Amber bar — the one that receives. */}
      <rect x="7" y="18.5" width="34" height="11" rx="5.5" fill={horizontal} />
      {/* Green bar — the one that gives. */}
      <rect x="18.5" y="7" width="11" height="34" rx="5.5" fill={vertical} />
      {/* What the meeting produces. */}
      <rect x="18.5" y="18.5" width="11" height="11" fill={intersection} />
    </svg>
  );
}

/**
 * App-icon lock-up: the mark inside its rounded brand tile.
 * Used where the symbol needs its own ground (install prompt, empty states).
 */
export function LogoTile({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-grid size-10 shrink-0 place-items-center rounded-[22%]',
        className,
      )}
      style={{ backgroundColor: BRAND.green }}
    >
      <LogoMark variant="onBrand" className="size-[70%]" />
    </span>
  );
}

/**
 * Full lock-up: mark plus wordmark.
 *
 * The wordmark is the Arabic form in Arabic and the Latin form elsewhere, and
 * each carries its own direction. Without that, bidi reordering renders the
 * Latin wordmark as "+Sadaqa" on an RTL page — the `+` is a neutral character,
 * so it takes the paragraph direction rather than the word's.
 */
export function Logo({
  className,
  compact = false,
  variant = 'default',
}: {
  className?: string;
  compact?: boolean;
  variant?: LogoVariant;
}) {
  const i18n = useOptionalI18n();
  const isArabic = i18n?.locale === 'ar';
  const name = isArabic ? 'صدقة' : 'Sadaqa';

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark variant={variant} title={isArabic ? 'صدقة+' : 'Sadaqa+'} />
      {!compact && (
        <span
          dir={isArabic ? 'rtl' : 'ltr'}
          className="text-lg font-bold tracking-tight text-foreground"
        >
          {name}
          <span
            className={variant === 'monochrome' ? 'text-foreground' : undefined}
            style={variant === 'monochrome' ? undefined : { color: BRAND.amber }}
          >
            +
          </span>
        </span>
      )}
    </span>
  );
}

export { BRAND };
