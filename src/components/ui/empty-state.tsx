import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The empty state is a first-class screen here, not a fallback.
 *
 * Sadaqa+ launches with a genuinely empty database, so "nothing yet" is the
 * normal state of most pages on day one. It must read as *new*, not broken:
 * a clear explanation of what will appear, and one obvious next action.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border bg-surface-muted/60 text-center',
        compact ? 'gap-3 px-6 py-10' : 'gap-4 px-6 py-16',
        className,
      )}
    >
      <div
        className={cn(
          'grid place-items-center rounded-2xl bg-surface text-muted-fg shadow-[var(--shadow-soft)]',
          compact ? 'size-11' : 'size-14',
        )}
        aria-hidden="true"
      >
        <Icon className={compact ? 'size-5' : 'size-6'} />
      </div>

      <div className="flex max-w-md flex-col gap-1.5">
        <p className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}>
          {title}
        </p>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-fg">{description}</p>
        ) : null}
      </div>

      {action || secondaryAction ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
