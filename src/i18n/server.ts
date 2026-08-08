import { notFound } from 'next/navigation';

import { getDictionary } from './index';
import { LOCALE_META, isLocale, type AppLocale } from './config';

/**
 * Resolves the `[locale]` route param for a server component.
 * An unknown locale is a 404 rather than a silent fallback — otherwise
 * `/xx/requests` would render French content under a wrong URL.
 */
export async function resolveLocale(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const typed = locale as AppLocale;
  return {
    locale: typed,
    t: getDictionary(typed),
    dir: LOCALE_META[typed].dir,
    /** Prefixes an app path with the active locale. */
    href: (path: string) => `/${typed}${path === '/' ? '' : path}`,
  };
}

export type LocaleContext = Awaited<ReturnType<typeof resolveLocale>>;
