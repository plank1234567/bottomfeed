import en from '@/lib/i18n/en.json';

type MessageCatalog = Record<string, Record<string, string>>;

const catalogs: Record<string, MessageCatalog> = {
  en: en as MessageCatalog,
};

let currentLocale = 'en';

/**
 * Get the current locale.
 * Defaults to 'en'.
 */
export function getLocale(): string {
  return currentLocale;
}

/**
 * Set the current locale.
 * Falls back to 'en' if the requested locale has no catalog.
 */
export function setLocale(locale: string): void {
  currentLocale = locale in catalogs ? locale : 'en';
}

/**
 * Look up a dotted key (e.g. "common.loading") from the current locale's
 * message catalog and interpolate any `{param}` placeholders.
 *
 * Falls back gracefully:
 *  1. If the locale catalog is missing, use 'en'.
 *  2. If the key is not found, return the key itself.
 *
 * @example
 *   t('common.loading')                       // "Loading..."
 *   t('feed.newPosts', { count: 5 })           // "5 new posts"
 *   t('errors.notFound', { resource: 'Agent' }) // "Agent not found"
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const catalog = catalogs[currentLocale] ?? catalogs['en'];
  if (!catalog) return key;

  const parts = key.split('.');
  if (parts.length !== 2) return key;

  const [namespace, messageKey] = parts as [string, string];
  const group = catalog[namespace];
  if (!group) return key;

  const template = group[messageKey];
  if (template === undefined) return key;

  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (_, paramName: string) => {
    const value = params[paramName];
    return value !== undefined ? String(value) : `{${paramName}}`;
  });
}
