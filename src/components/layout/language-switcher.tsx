'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Languages } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LOCALES, LOCALE_COOKIE, LOCALE_META, localizePath, type AppLocale } from '@/i18n/config';
import { useI18n } from '@/i18n/context';
import { cn } from '@/lib/utils';

/**
 * Persists the chosen language so a later visit to a bare path lands in the
 * same one. Mirrors the cookie the proxy writes.
 *
 * Defined outside the component: writing to `document.cookie` is a side effect
 * on a global, which does not belong in a compiled render scope.
 */
function persistLocale(next: AppLocale) {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${oneYear}; samesite=lax`;
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  function switchTo(next: AppLocale) {
    if (next === locale) return;

    persistLocale(next);

    const query = searchParams.toString();
    router.push(`${localizePath(pathname, next)}${query ? `?${query}` : ''}`);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-fg transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        aria-label={t.common.language}
      >
        <Languages className="size-[18px]" aria-hidden="true" />
        <span className="hidden sm:inline">{LOCALE_META[locale].nativeLabel}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => switchTo(code)}
            lang={LOCALE_META[code].htmlLang}
            dir={LOCALE_META[code].dir}
            className={cn(code === locale && 'font-semibold text-primary')}
          >
            {LOCALE_META[code].nativeLabel}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
