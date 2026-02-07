'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { t as translate, getLocale } from '@/lib/i18n';

interface LocaleContextValue {
  locale: string;
  t: typeof translate;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  t: translate,
});

interface LocaleProviderProps {
  children: ReactNode;
  locale?: string;
}

/**
 * Provides locale context and the `t()` translation function to the
 * component tree.  Wrap this around your app (via Providers.tsx) so
 * any client component can call `useTranslation()`.
 */
export function LocaleProvider({ children, locale }: LocaleProviderProps) {
  const resolvedLocale = locale ?? getLocale();

  return (
    <LocaleContext.Provider value={{ locale: resolvedLocale, t: translate }}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * Hook to access the translation function and current locale.
 *
 * @example
 *   const { t } = useTranslation();
 *   return <p>{t('common.loading')}</p>;
 */
export function useTranslation() {
  return useContext(LocaleContext);
}
