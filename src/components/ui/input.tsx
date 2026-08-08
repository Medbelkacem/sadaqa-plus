'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

import { useFieldControl } from './field';

const fieldBase =
  'w-full rounded-[var(--radius-field)] border border-border bg-surface px-3.5 text-sm text-foreground transition-colors placeholder:text-muted-fg/70 hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/30';

/**
 * Controls read the surrounding `<Field>` for their id, `aria-describedby`
 * and `aria-invalid`. Used outside a Field they behave like plain elements,
 * so nothing breaks — the wiring is additive.
 */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => {
    const wiring = useFieldControl();
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          fieldBase,
          'h-10',
          'file:mr-3 file:border-0 file:bg-transparent file:text-sm',
          className,
        )}
        {...wiring}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 5, ...props }, ref) => {
  const wiring = useFieldControl();
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(fieldBase, 'min-h-24 resize-y py-2.5 leading-relaxed', className)}
      {...wiring}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

/**
 * Native select.
 *
 * Radix Select is used where rich content is needed; for long reference lists
 * (58 wilayas, 1,541 communes) the native control is faster, fully accessible,
 * searchable by typing, and far better on mobile.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => {
  const wiring = useFieldControl();
  return (
    <select
      ref={ref}
      className={cn(
        fieldBase,
        'h-10 cursor-pointer appearance-none bg-[length:1rem] bg-no-repeat pe-9',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23576076' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        '[background-position:right_0.75rem_center] rtl:[background-position:left_0.75rem_center]',
        className,
      )}
      {...wiring}
      {...props}
    />
  );
});
Select.displayName = 'Select';

export { fieldBase };
