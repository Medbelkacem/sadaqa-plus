'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Plus, Search } from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
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

export function SiteHeader() {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const pathname = usePathname();
  const { authenticated } = useSession();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [openedAt, setOpenedAt] = React.useState(pathname);

  // Close the drawer when navigation completes. Adjusting state during render
  // on a changed input is React's documented pattern for this; an effect would
  // leave the old drawer painted for a frame.
  if (pathname !== openedAt) {
    setOpenedAt(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  const links = [
    { path: '/requests', label: t.nav.requests },
    { path: '/campaigns', label: t.nav.campaigns },
    { path: '/events', label: t.nav.events },
    { path: '/volunteer', label: t.nav.volunteer },
    { path: '/organizations', label: t.nav.organizations },
    { path: '/map', label: t.nav.map },
  ];

  const isActive = (path: string) => pathname.includes(path);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-fg transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
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
                            'flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
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
            </SheetBody>
          </SheetContent>
        </Sheet>

        <Link
          href={href('/')}
          className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo />
          <span className="sr-only">{t.nav.home}</span>
        </Link>

        <nav aria-label={t.nav.menu} className="ms-4 hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {links.map((link) => (
              <li key={link.path}>
                <Link
                  href={href(link.path)}
                  aria-current={isActive(link.path) ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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

        <div className="ms-auto flex items-center gap-1">
          <Link
            href={href('/search')}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-fg transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t.common.search}
          >
            <Search className="size-[18px]" aria-hidden="true" />
          </Link>

          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href={href('/requests/new')}>
              <Plus aria-hidden="true" />
              {t.nav.create}
            </Link>
          </Button>

          <LanguageSwitcher />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
