'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Plus, Search } from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/misc';
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';

import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

/**
 * Site header.
 *
 * The chrome is budgeted per breakpoint, because six navigation links plus a
 * create button, search, language, theme and account controls do not fit
 * together below ~1400px:
 *
 *   < 640px   mark only, plus search and the account control. Language and
 *             theme live in the drawer.
 *   ≥ 640px   full wordmark.
 *   ≥ 1024px  primary navigation appears, with the four highest-priority
 *             links; theme toggle joins the bar.
 *   ≥ 1280px  the remaining links, the labelled create button and the
 *             language switcher appear.
 *
 * Anything hidden at a given width is always reachable from the drawer or the
 * bottom navigation — nothing is dropped, only relocated.
 */
export function SiteHeader() {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const pathname = usePathname();
  const { authenticated } = useSession();

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [openedAt, setOpenedAt] = React.useState(pathname);

  // Close the drawer when navigation completes. Adjusting state during render
  // on a changed input is React's documented pattern; an effect would leave
  // the old drawer painted for a frame.
  if (pathname !== openedAt) {
    setOpenedAt(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  const links = [
    { path: '/requests', label: t.nav.requests, primary: true },
    { path: '/campaigns', label: t.nav.campaigns, primary: true },
    { path: '/events', label: t.nav.events, primary: true },
    { path: '/volunteer', label: t.nav.volunteer, primary: true },
    { path: '/organizations', label: t.nav.organizations, primary: false },
    { path: '/map', label: t.nav.map, primary: false },
  ];

  const isActive = (path: string) => pathname.includes(path);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-fg transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            aria-label={t.nav.openMenu}
          >
            <Menu className="size-5" aria-hidden="true" />
          </SheetTrigger>

          <SheetContent side="start" closeLabel={t.common.close}>
            <SheetHeader>
              <SheetTitle asChild>
                <span>
                  <Logo />
                </span>
              </SheetTitle>
            </SheetHeader>

            <SheetBody>
              <nav aria-label={t.nav.menu}>
                <ul className="flex flex-col gap-0.5">
                  {links.map((link) => (
                    <li key={link.path}>
                      <SheetClose asChild>
                        <Link
                          href={href(link.path)}
                          className={cn(
                            'flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors',
                            isActive(link.path)
                              ? 'bg-primary-soft text-primary-soft-fg'
                              : 'text-foreground hover:bg-surface-muted',
                          )}
                        >
                          {link.label}
                        </Link>
                      </SheetClose>
                    </li>
                  ))}
                  <li>
                    <SheetClose asChild>
                      <Link
                        href={href('/search')}
                        className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                      >
                        {t.common.search}
                      </Link>
                    </SheetClose>
                  </li>
                </ul>
              </nav>

              <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
                <Button asChild block>
                  <Link href={href('/requests/new')}>{t.requests.createTitle}</Link>
                </Button>
                <Button asChild variant="secondary" block>
                  <Link href={href('/volunteer')}>{t.volunteer.becomeVolunteer}</Link>
                </Button>
                {!authenticated && (
                  <Button asChild variant="ghost" block>
                    <Link href={href('/auth/login')}>{t.nav.login}</Link>
                  </Button>
                )}
              </div>

              {/* Language and theme live here on the widths where the bar has
                  no room for them. */}
              <div className="mt-6 border-t border-border pt-6 xl:hidden">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-fg">
                  {t.common.language} · {t.common.theme}
                </p>
                <div className="flex items-center gap-1">
                  <LanguageSwitcher showLabel />
                  <Separator orientation="vertical" className="mx-1 h-6" />
                  <ThemeToggle />
                </div>
              </div>
            </SheetBody>
          </SheetContent>
        </Sheet>

        <Link
          href={href('/')}
          className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* Mark only on the narrowest phones, where the wordmark would push
              the account control off-screen. */}
          <Logo compact className="sm:hidden" />
          <Logo className="hidden sm:inline-flex" />
          <span className="sr-only">{t.nav.home}</span>
        </Link>

        <nav aria-label={t.nav.menu} className="ms-2 hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {links.map((link) => (
              <li key={link.path} className={link.primary ? undefined : 'hidden xl:block'}>
                <Link
                  href={href(link.path)}
                  aria-current={isActive(link.path) ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 items-center whitespace-nowrap rounded-lg px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:px-3 xl:text-sm',
                    isActive(link.path)
                      ? 'bg-surface-muted text-foreground'
                      : 'text-muted-fg hover:bg-surface-muted hover:text-foreground',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          <Link
            href={href('/search')}
            className="inline-flex size-10 items-center justify-center rounded-lg text-muted-fg transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t.common.search}
          >
            <Search className="size-[18px]" aria-hidden="true" />
          </Link>

          {/* Icon-only from lg, labelled from xl. On phones the bottom
              navigation carries this action. */}
          <Button asChild size="icon" className="hidden lg:inline-flex xl:hidden">
            <Link href={href('/requests/new')} aria-label={t.nav.create}>
              <Plus aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="sm" className="hidden xl:inline-flex">
            <Link href={href('/requests/new')}>
              <Plus aria-hidden="true" />
              {t.nav.create}
            </Link>
          </Button>

          <LanguageSwitcher className="hidden lg:inline-flex" />
          <ThemeToggle className="hidden lg:inline-flex" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
