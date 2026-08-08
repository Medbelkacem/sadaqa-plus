/**
 * Locale configuration.
 *
 * Pages live under `/[locale]/…`, so every URL is shareable and indexable in
 * the language it was read in. There is exactly one page tree — locales are
 * resolved from the segment and applied through translation resources.
 */

export const LOCALES = ['fr', 'ar', 'en'] as const;

export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'fr';

export const LOCALE_COOKIE = 'sadaqa_locale';

export const LOCALE_META: Record<
  AppLocale,
  { label: string; nativeLabel: string; dir: 'ltr' | 'rtl'; htmlLang: string; dbValue: 'FR' | 'AR' | 'EN' }
> = {
  fr: { label: 'French', nativeLabel: 'Français', dir: 'ltr', htmlLang: 'fr-DZ', dbValue: 'FR' },
  ar: { label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl', htmlLang: 'ar-DZ', dbValue: 'AR' },
  en: { label: 'English', nativeLabel: 'English', dir: 'ltr', htmlLang: 'en', dbValue: 'EN' },
};

export function isLocale(value: string | undefined | null): value is AppLocale {
  return Boolean(value) && (LOCALES as readonly string[]).includes(value!);
}

export function dirOf(locale: AppLocale) {
  return LOCALE_META[locale].dir;
}

/** Maps the URL locale to the Prisma `Locale` enum used for stored preferences. */
export function toDbLocale(locale: AppLocale) {
  return LOCALE_META[locale].dbValue;
}

export function fromDbLocale(value: 'FR' | 'AR' | 'EN'): AppLocale {
  return value === 'AR' ? 'ar' : value === 'EN' ? 'en' : 'fr';
}

/**
 * Picks the best locale from an Accept-Language header.
 * Falls back to French, the platform's primary language.
 */
export function negotiateLocale(acceptLanguage: string | null): AppLocale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((entry) => Number.isFinite(entry.q))
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split('-')[0];
    if (isLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}

/** Replaces the locale segment of a pathname, preserving the rest. */
export function localizePath(pathname: string, locale: AppLocale) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && isLocale(segments[0])) {
    segments[0] = locale;
  } else {
    segments.unshift(locale);
  }
  return `/${segments.join('/')}`;
}
