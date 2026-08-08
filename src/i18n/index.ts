import { ar } from './dictionaries/ar';
import { en } from './dictionaries/en';
import { fr, type Dictionary } from './dictionaries/fr';
import { DEFAULT_LOCALE, type AppLocale } from './config';

const DICTIONARIES: Record<AppLocale, Dictionary> = { fr, ar, en };

/**
 * Returns the dictionary for a locale.
 *
 * Dictionaries are plain modules rather than dynamic imports: the whole set is
 * a few kilobytes gzipped, and shipping them statically keeps server
 * components synchronous and avoids a waterfall on first paint.
 */
export function getDictionary(locale: AppLocale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export type { Dictionary };
export { fr, ar, en };
