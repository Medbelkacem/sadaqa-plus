import type { AppLocale } from './config';

/**
 * Locale-aware formatting.
 *
 * Numbers use Western Arabic digits in every locale — this is what Algerian
 * users read on invoices, bank statements and administrative documents,
 * including in Arabic-language contexts.
 */

const INTL_LOCALE: Record<AppLocale, string> = {
  fr: 'fr-DZ',
  ar: 'ar-DZ-u-nu-latn',
  en: 'en-GB',
};

export function formatNumber(value: number, locale: AppLocale) {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

/** Algerian dinar. `DZD` renders as "DA" in local usage. */
export function formatCurrency(value: number, locale: AppLocale, currency = 'DZD') {
  const formatted = new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'decimal',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
  return currency === 'DZD' ? `${formatted} DA` : `${formatted} ${currency}`;
}

export function formatDate(value: Date | string, locale: AppLocale) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: Date | string, locale: AppLocale) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatTime(value: Date | string, locale: AppLocale) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

export function formatRelative(value: Date | string, locale: AppLocale, now = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const diff = date.getTime() - now.getTime();
  const formatter = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: 'auto' });

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return formatter.format(Math.round(diff / 1000), 'second');
}

/** Picks the right name column for a wilaya/commune/category row. */
export function localizedName(
  row: { nameFr: string; nameAr: string; nameEn: string },
  locale: AppLocale,
) {
  if (locale === 'ar') return row.nameAr;
  if (locale === 'en') return row.nameEn;
  return row.nameFr;
}
