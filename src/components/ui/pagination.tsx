'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useI18n } from '@/i18n/context';
import { cn } from '@/lib/utils';

/**
 * Link-based pagination.
 *
 * Uses real anchors rather than buttons so pages are shareable, indexable and
 * work with middle-click and browser history. `rel=prev/next` helps crawlers
 * understand the sequence.
 */
export function Pagination({
  page,
  totalPages,
  className,
}: {
  page: number;
  totalPages: number;
  className?: string;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete('page');
    else params.set('page', String(target));
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ''}`;
  };

  // Show first, last, current and its neighbours; elide the rest.
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const visible = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  return (
    <nav
      aria-label={t.common.page}
      className={cn('flex items-center justify-center gap-1', className)}
    >
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          rel="prev"
          aria-label={t.common.previous}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-fg transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      ) : null}

      {visible.map((target, index) => {
        const previous = visible[index - 1];
        const gap = previous !== undefined && target - previous > 1;

        return (
          <span key={target} className="flex items-center gap-1">
            {gap ? (
              <span className="px-1 text-sm text-muted-fg" aria-hidden="true">
                …
              </span>
            ) : null}
            <Link
              href={hrefFor(target)}
              aria-current={target === page ? 'page' : undefined}
              aria-label={`${t.common.page} ${target}`}
              className={cn(
                'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                target === page
                  ? 'border-primary bg-primary text-primary-fg'
                  : 'border-border text-muted-fg hover:bg-surface-muted hover:text-foreground',
              )}
            >
              {target}
            </Link>
          </span>
        );
      })}

      {page < totalPages ? (
        <Link
          href={hrefFor(page + 1)}
          rel="next"
          aria-label={t.common.next}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-fg transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  );
}
