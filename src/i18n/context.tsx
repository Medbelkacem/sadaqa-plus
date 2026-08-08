'use client';

import * as React from 'react';

import type { Dictionary } from './dictionaries/fr';
import type { AppLocale } from './config';

/**
 * Client-side access to the active locale and its dictionary.
 *
 * The dictionary is handed down from the server layout rather than imported in
 * client components: that way the browser bundle carries the strings for the
 * requested language only, instead of all three.
 */

type I18nValue = {
  locale: AppLocale;
  dir: 'ltr' | 'rtl';
  t: Dictionary;
};

const I18nContext = React.createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  dir,
  dictionary,
  children,
}: {
  locale: AppLocale;
  dir: 'ltr' | 'rtl';
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const value = React.useMemo<I18nValue>(
    () => ({ locale, dir, t: dictionary }),
    [locale, dir, dictionary],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = React.useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside <I18nProvider>.');
  }
  return context;
}

/** Prefixes a path with the active locale: `href('/requests')` → `/fr/requests`. */
export function useLocalizedHref() {
  const { locale } = useI18n();
  return React.useCallback(
    (path: string) => (path.startsWith('/') ? `/${locale}${path === '/' ? '' : path}` : path),
    [locale],
  );
}
