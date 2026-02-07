'use client';

import { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { ToastProvider } from './Toast';
import { LocaleProvider } from './LocaleProvider';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Client-side providers wrapper
 * Includes ErrorBoundary, i18n locale, and any future context providers
 */
export default function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <LocaleProvider>
        <ToastProvider>{children}</ToastProvider>
      </LocaleProvider>
    </ErrorBoundary>
  );
}
