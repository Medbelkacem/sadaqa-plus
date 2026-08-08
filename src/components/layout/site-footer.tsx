'use client';

import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { useI18n, useLocalizedHref } from '@/i18n/context';

export function SiteFooter() {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const year = new Date().getFullYear();

  const columns = [
    {
      title: t.footer.platform,
      links: [
        { path: '/requests', label: t.nav.requests },
        { path: '/campaigns', label: t.nav.campaigns },
        { path: '/events', label: t.nav.events },
        { path: '/map', label: t.nav.map },
      ],
    },
    {
      title: t.footer.community,
      links: [
        { path: '/volunteer', label: t.nav.volunteer },
        { path: '/organizations', label: t.nav.organizations },
        { path: '/organizations/apply', label: t.organizations.applyTitle },
        { path: '/requests/new', label: t.requests.createTitle },
      ],
    },
    {
      title: t.footer.legalSection,
      links: [
        { path: '/legal/terms', label: t.legal.terms },
        { path: '/legal/privacy', label: t.legal.privacy },
        { path: '/legal/cookies', label: t.legal.cookies },
        { path: '/legal/contact', label: t.legal.contact },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-surface-muted/50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed text-muted-fg">{t.footer.tagline}</p>
            <p className="mt-4 text-xs leading-relaxed text-muted-fg">
              {t.legal.noCharityClaim}
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                {column.title}
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.path}>
                    <Link
                      href={href(link.path)}
                      className="text-sm text-muted-fg underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-fg sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} Sadaqa+. {t.footer.rights}
          </p>
          <p>{t.footer.builtIn}</p>
        </div>
      </div>
    </footer>
  );
}
