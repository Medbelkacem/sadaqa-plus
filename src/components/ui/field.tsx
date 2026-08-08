'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Accessible form field wrapper.
 *
 * Wires label ↔ control ↔ hint ↔ error via ids so a screen reader announces
 * the hint and the error text with the field, and sets `aria-invalid` on the
 * control automatically. Components below never need to remember to do it.
 */

type FieldContextValue = {
  id: string;
  hintId?: string;
  errorId?: string;
  invalid: boolean;
};

const FieldContext = React.createContext<FieldContextValue | null>(null);

export function useFieldControl() {
  const context = React.useContext(FieldContext);
  if (!context) return {};
  const describedBy = [context.hintId, context.errorId].filter(Boolean).join(' ') || undefined;
  return {
    id: context.id,
    'aria-describedby': describedBy,
    'aria-invalid': context.invalid || undefined,
  } as const;
}

export function Field({
  children,
  error,
  hint,
  className,
  id: providedId,
}: {
  children: React.ReactNode;
  error?: string | null;
  hint?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const generatedId = React.useId();
  const id = providedId ?? generatedId;

  const value = React.useMemo<FieldContextValue>(
    () => ({
      id,
      hintId: hint ? `${id}-hint` : undefined,
      errorId: error ? `${id}-error` : undefined,
      invalid: Boolean(error),
    }),
    [id, hint, error],
  );

  return (
    <FieldContext.Provider value={value}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        {children}
        {hint && !error ? (
          <p id={value.hintId} className="text-xs leading-relaxed text-muted-fg">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p
            id={value.errorId}
            className="flex items-start gap-1.5 text-xs font-medium text-danger"
          >
            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export function FieldLabel({
  className,
  optional,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { optional?: string }) {
  const context = React.useContext(FieldContext);
  return (
    <LabelPrimitive.Root
      htmlFor={context?.id}
      className={cn('text-sm font-medium leading-none text-foreground', className)}
      {...props}
    >
      {children}
      {optional ? (
        <span className="ms-1.5 text-xs font-normal text-muted-fg">({optional})</span>
      ) : null}
    </LabelPrimitive.Root>
  );
}

/** Applies the wiring to any control that forwards native props. */
export function FieldControl<P extends object>({
  as: Component,
  ...props
}: { as: React.ComponentType<P> } & Omit<P, 'id'>) {
  const wiring = useFieldControl();
  return <Component {...(props as P)} {...wiring} />;
}
