'use client';

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Multi-step progress indicator.
 *
 * Rendered as an ordered list with `aria-current="step"` so a screen reader
 * announces position without needing the visual scale. On narrow screens it
 * collapses to "Step N of M" plus a bar, because seven labels do not fit.
 */
export function Stepper({
  steps,
  current,
  stepLabel,
  onStepClick,
  maxReached,
}: {
  steps: string[];
  current: number;
  stepLabel: string;
  onStepClick?: (index: number) => void;
  maxReached: number;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-fg sm:hidden">
        {stepLabel} {current + 1}/{steps.length} — {steps[current]}
      </p>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken sm:hidden"
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-label={stepLabel}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${((current + 1) / steps.length) * 100}%` }}
        />
      </div>

      <ol className="hidden items-center gap-1 sm:flex">
        {steps.map((label, index) => {
          const done = index < current;
          const active = index === current;
          const reachable = index <= maxReached;

          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!reachable || !onStepClick}
                onClick={() => onStepClick?.(index)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  reachable && onStepClick && !active && 'hover:bg-surface-muted',
                  !reachable && 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors',
                    done && 'bg-primary text-primary-fg',
                    active && 'bg-primary-soft text-primary-soft-fg ring-2 ring-primary',
                    !done && !active && 'bg-surface-sunken text-muted-fg',
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'hidden whitespace-nowrap text-xs font-medium lg:inline',
                    active ? 'text-foreground' : 'text-muted-fg',
                  )}
                >
                  {label}
                </span>
              </button>

              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-px flex-1 transition-colors',
                    done ? 'bg-primary' : 'bg-border',
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
