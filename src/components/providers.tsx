'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import type { AppLocale } from '@/i18n/config';
import { I18nProvider } from '@/i18n/context';
import type { Dictionary } from '@/i18n';

/**
 * Client providers.
 *
 * The QueryClient is created inside state so each browser session gets its
 * own instance and server renders never share cache between requests.
 */
export function Providers({
  children,
  locale,
  dir,
  dictionary,
}: {
  children: React.ReactNode;
  locale: AppLocale;
  dir: 'ltr' | 'rtl';
  dictionary: Dictionary;
}) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: (failureCount, error) => {
              // Do not retry authorization or validation failures — they will
              // fail identically every time and just add latency.
              const status = (error as { status?: number })?.status;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        storageKey="sadaqa-theme"
      >
        <TooltipPrimitive.Provider delayDuration={250} skipDelayDuration={400}>
          <I18nProvider locale={locale} dir={dir} dictionary={dictionary}>
            {children}
          </I18nProvider>
          <Toaster
            position={dir === 'rtl' ? 'top-left' : 'top-right'}
            dir={dir}
            closeButton
            richColors
            toastOptions={{
              classNames: {
                toast:
                  'rounded-[var(--radius-card)] border border-border bg-surface text-foreground shadow-[var(--shadow-lifted)]',
              },
            }}
            // Announced politely so a toast never interrupts a screen reader
            // mid-sentence.
            visibleToasts={3}
          />
        </TooltipPrimitive.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
