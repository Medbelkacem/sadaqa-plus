import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5 [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-muted text-muted-fg',
        primary: 'border-transparent bg-primary-soft text-primary-soft-fg',
        accent: 'border-transparent bg-accent-soft text-accent-soft-fg',
        success: 'border-transparent bg-success-soft text-success-soft-fg',
        warning: 'border-transparent bg-warning-soft text-warning-soft-fg',
        danger: 'border-transparent bg-danger-soft text-danger-soft-fg',
        info: 'border-transparent bg-info-soft text-info-soft-fg',
        outline: 'border-border-strong bg-transparent text-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
