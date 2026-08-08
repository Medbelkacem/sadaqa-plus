'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '@/lib/utils';

/**
 * Progress bar.
 *
 * `value` is always a real, server-computed ratio. When there is no target to
 * measure against, callers pass `null` and render an explicit "no target" line
 * instead of a bar — the component refuses to invent a percentage.
 */
export function Progress({
  value,
  className,
  tone = 'primary',
  label,
}: {
  value: number | null;
  className?: string;
  tone?: 'primary' | 'accent';
  label?: string;
}) {
  if (value === null) return null;

  const clamped = Math.max(0, Math.min(100, value));

  return (
    <ProgressPrimitive.Root
      value={clamped}
      aria-label={label}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-surface-sunken',
        className,
      )}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none',
          tone === 'primary' ? 'bg-primary' : 'bg-accent',
        )}
        style={{ width: `${clamped}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
