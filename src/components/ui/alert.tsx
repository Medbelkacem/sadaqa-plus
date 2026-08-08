import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

const alertVariants = cva(
  'flex gap-3 rounded-[var(--radius-card)] border p-4 text-sm leading-relaxed',
  {
    variants: {
      tone: {
        info: 'border-info/25 bg-info-soft text-info-soft-fg',
        success: 'border-success/25 bg-success-soft text-success-soft-fg',
        warning: 'border-warning/30 bg-warning-soft text-warning-soft-fg',
        danger: 'border-danger/25 bg-danger-soft text-danger-soft-fg',
        neutral: 'border-border bg-surface-muted text-foreground',
      },
    },
    defaultVariants: { tone: 'info' },
  },
);

const DEFAULT_ICONS: Record<string, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: ShieldAlert,
  neutral: Info,
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  icon?: LucideIcon | null;
}

export function Alert({ className, tone = 'info', title, icon, children, ...props }: AlertProps) {
  const Icon = icon === null ? null : (icon ?? DEFAULT_ICONS[tone ?? 'info']);

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      {Icon ? <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden="true" /> : null}
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="[&_a]:underline [&_a]:underline-offset-2">{children}</div> : null}
      </div>
    </div>
  );
}
