'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Flag,
  LayoutDashboard,
  Megaphone,
  Menu,
  ScrollText,
  Settings,
  Shapes,
  Users,
} from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { PERMISSIONS, type PermissionKey } from '@/server/permissions/definitions';
import { cn } from '@/lib/utils';

type BadgeCounts = { requests: number; applications: number; reports: number };

/**
 * Admin navigation.
 *
 * Each entry declares the permission it requires. The list is filtered against
 * the server-derived permission set, so a MODERATOR sees the moderation
 * sections and not the administration ones. This is presentation only — the
 * routes themselves enforce the same permissions.
 */
export function AdminShell({
  children,
  permissions,
  displayName,
  badges,
  labels,
}: {
  children: React.ReactNode;
  permissions: string[];
  displayName: string;
  badges: BadgeCounts;
  labels: { title: string; backToSite: string };
}) {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [openedAt, setOpenedAt] = React.useState(pathname);

  // Close the drawer once navigation completes — adjusted during render rather
  // than from an effect, so the old panel is never painted for a frame.
  if (pathname !== openedAt) {
    setOpenedAt(pathname);
    if (open) setOpen(false);
  }

  const has = (permission: PermissionKey) => permissions.includes(permission);

  const items = [
    { path: '/admin', label: t.admin.overview, icon: LayoutDashboard, show: true },
    {
      path: '/admin/requests',
      label: t.admin.requests,
      icon: ClipboardList,
      show: has(PERMISSIONS.REQUEST_MODERATE),
      badge: badges.requests,
    },
    {
      path: '/admin/campaigns',
      label: t.admin.campaigns,
      icon: Megaphone,
      show: has(PERMISSIONS.CAMPAIGN_MODERATE),
    },
    {
      path: '/admin/events',
      label: t.admin.events,
      icon: CalendarDays,
      show: has(PERMISSIONS.EVENT_MODERATE),
    },
    {
      path: '/admin/organizations/applications',
      label: t.admin.organizations,
      icon: Building2,
      show: has(PERMISSIONS.PARTNER_APPLICATION_REVIEW),
      badge: badges.applications,
    },
    {
      path: '/admin/reports',
      label: t.admin.reports,
      icon: Flag,
      show: has(PERMISSIONS.REPORT_MODERATE),
      badge: badges.reports,
    },
    {
      path: '/admin/users',
      label: t.admin.users,
      icon: Users,
      show: has(PERMISSIONS.USER_READ_ANY),
    },
    {
      path: '/admin/categories',
      label: t.admin.categories,
      icon: Shapes,
      show: has(PERMISSIONS.CATEGORY_MANAGE),
    },
    {
      path: '/admin/audit',
      label: t.admin.auditLogs,
      icon: ScrollText,
      show: has(PERMISSIONS.AUDIT_READ),
    },
    {
      path: '/admin/settings',
      label: t.admin.settings,
      icon: Settings,
      show: has(PERMISSIONS.SETTING_MANAGE),
    },
  ].filter((item) => item.show);

  const isActive = (path: string) => {
    const target = href(path);
    if (path === '/admin') return pathname === target;
    return pathname.startsWith(target);
  };

  const nav = (
    <nav aria-label={labels.title}>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.path}>
            <Link
              href={href(item.path)}
              aria-current={isActive(item.path) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive(item.path)
                  ? 'bg-primary-soft text-primary-soft-fg'
                  : 'text-muted-fg hover:bg-surface-muted hover:text-foreground',
              )}
            >
              <item.icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="grid min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-danger-fg">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-fg transition-colors hover:bg-surface-muted lg:hidden"
              aria-label={t.nav.openMenu}
            >
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="start" closeLabel={t.common.close}>
              <SheetHeader>
                <SheetTitle asChild>
                  <span className="text-sm font-semibold">{labels.title}</span>
                </SheetTitle>
              </SheetHeader>
              <SheetBody>{nav}</SheetBody>
            </SheetContent>
          </Sheet>

          <Link href={href('/')} className="flex items-center gap-2">
            <Logo compact />
            <span className="hidden text-sm font-semibold text-foreground sm:inline">
              {labels.title}
            </span>
          </Link>

          <div className="ms-auto flex items-center gap-1">
            <Link
              href={href('/')}
              className="hidden rounded-lg px-3 py-1.5 text-sm text-muted-fg transition-colors hover:bg-surface-muted hover:text-foreground sm:inline-block"
            >
              {labels.backToSite}
            </Link>
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[110rem] flex-1 gap-8 px-4 py-8 sm:px-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">
            {nav}
            <p className="mt-6 border-t border-border pt-4 text-xs text-muted-fg">
              {displayName}
            </p>
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
