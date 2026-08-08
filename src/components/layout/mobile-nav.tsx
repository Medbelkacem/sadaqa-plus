'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Home, Map, PlusCircle, User } from 'lucide-react';

import { useI18n, useLocalizedHref } from '@/i18n/context';
import { useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';

/**
 * Bottom navigation for small screens.
 *
 * Five destinations, 56px touch targets, and `env(safe-area-inset-bottom)`
 * padding so the bar clears the home indicator on iOS.
 */
export function MobileNav() {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const pathname = usePathname();
  const { authenticated } = useSession();

  const items = [
    { path: '/', label: t.nav.home, icon: Home, exact: true },
    { path: '/requests', label: t.nav.explore, icon: Compass },
    { path: '/map', label: t.nav.map, icon: Map },
    { path: '/requests/new', label: t.nav.create, icon: PlusCircle },
    {
      path: authenticated ? '/dashboard' : '/auth/login',
      // A five-cell bar gives each label ~78px at 390px, so the labels here
      // are short by design — 'Se connecter' would be clipped.
      label: authenticated ? t.nav.profile : t.nav.account,
      icon: User,
    },
  ];

  const isActive = (path: string, exact?: boolean) => {
    const target = href(path);
    if (exact) return pathname === target || pathname === `${target}/`;
    return pathname.startsWith(target);
  };

  return (
    <nav
      aria-label={t.nav.menu}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map((item) => {
          const active = isActive(item.path, item.exact);
          const Icon = item.icon;
          return (
            <li key={item.path} className="flex-1">
              <Link
                href={href(item.path)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  active ? 'text-primary' : 'text-muted-fg',
                )}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
