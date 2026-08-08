import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Arabic } from 'next/font/google';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Script from 'next/script';

import '../globals.css';

import { Providers } from '@/components/providers';
import { LOCALES, LOCALE_META, isLocale, type AppLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-noto-arabic',
  display: 'swap',
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Users must be able to zoom. Locking the scale is an accessibility failure.
  maximumScale: 5,
  viewportFit: 'cover',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = getDictionary(locale);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return {
    metadataBase: new URL(appUrl),
    title: {
      default: `${t.brand.name} — ${t.brand.tagline}`,
      template: `%s · ${t.brand.name}`,
    },
    description: t.brand.description,
    applicationName: t.brand.name,
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: t.brand.name,
      statusBarStyle: 'default',
    },
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(
        LOCALES.map((l) => [LOCALE_META[l].htmlLang, `/${l}`]),
      ),
    },
    openGraph: {
      type: 'website',
      siteName: t.brand.name,
      locale: LOCALE_META[locale].htmlLang.replace('-', '_'),
      title: `${t.brand.name} — ${t.brand.tagline}`,
      description: t.brand.description,
      url: `/${locale}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${t.brand.name} — ${t.brand.tagline}`,
      description: t.brand.description,
    },
    icons: {
      icon: [
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: '/icons/apple-touch-icon.png',
    },
    formatDetection: { telephone: false },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const typedLocale = locale as AppLocale;
  const { dir, htmlLang } = LOCALE_META[typedLocale];
  const t = getDictionary(typedLocale);

  // Set by middleware; used to authorise Next's inline bootstrap under CSP.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang={htmlLang}
      dir={dir}
      suppressHydrationWarning
      className={`${inter.variable} ${notoArabic.variable}`}
    >
      <body className="min-h-dvh bg-background antialiased">
        {/* next-themes writes the class before paint; without this the page
            flashes light before switching to a stored dark preference. */}
        <Script id="theme-init" strategy="beforeInteractive" nonce={nonce}>
          {`(function(){try{var s=localStorage.getItem('sadaqa-theme')||'system';var d=s==='dark'||(s==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`}
        </Script>

        <a
          href="#main"
          className="sr-only-focusable absolute z-[100] m-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg"
        >
          {t.common.skipToContent}
        </a>

        <Providers locale={typedLocale} dir={dir} dictionary={t}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
