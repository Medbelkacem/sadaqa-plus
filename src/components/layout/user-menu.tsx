'use client';

import Link from 'next/link';
import {
  Bell,
  Building2,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/misc';
import { useI18n, useLocalizedHref } from '@/i18n/context';
import { useLogout, useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';

export function UserMenu() {
  const { t } = useI18n();
  const href = useLocalizedHref();
  const { authenticated, user, isStaff, organizations, unreadNotifications, isLoading } =
    useSession();
  const logout = useLogout();

  if (isLoading) {
    return <div className="size-9 rounded-full bg-surface-sunken" aria-hidden="true" />;
  }

  if (!authenticated || !user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link href={href('/auth/login')}>{t.nav.login}</Link>
        </Button>
        <Button asChild size="sm">
          <Link href={href('/auth/register')}>{t.nav.register}</Link>
        </Button>
      </div>
    );
  }

  const primaryOrg = organizations[0];

  return (
    <div className="flex items-center gap-1">
      <Link
        href={href('/notifications')}
        className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-fg transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={
          unreadNotifications > 0
            ? `${t.nav.notifications} (${unreadNotifications})`
            : t.nav.notifications
        }
      >
        <Bell className="size-[18px]" aria-hidden="true" />
        {unreadNotifications > 0 && (
          <span
            className="absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-danger-fg"
            aria-hidden="true"
          >
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={t.nav.profile}
        >
          <Avatar
            name={user.displayName}
            src={user.avatarId ? `/api/files/${user.avatarId}` : null}
            size={36}
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="normal-case">
            <span className="block truncate text-sm font-semibold text-foreground">
              {user.displayName}
            </span>
            <span className="block truncate text-xs font-normal normal-case text-muted-fg">
              {user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href={href('/dashboard')}>
              <LayoutDashboard aria-hidden="true" />
              {t.nav.dashboard}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={href('/messages')}>
              <MessageSquare aria-hidden="true" />
              {t.nav.messages}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={href('/profile')}>
              <UserIcon aria-hidden="true" />
              {t.profile.title}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={href('/volunteer/profile')}>
              <HeartHandshake aria-hidden="true" />
              {t.volunteer.profileTitle}
            </Link>
          </DropdownMenuItem>

          {primaryOrg ? (
            <DropdownMenuItem asChild>
              <Link href={href(`/organizations/${primaryOrg.slug}/manage`)}>
                <Building2 aria-hidden="true" />
                <span className="truncate">{primaryOrg.publicName}</span>
              </Link>
            </DropdownMenuItem>
          ) : null}

          {isStaff ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={href('/admin')}>
                  <ShieldCheck aria-hidden="true" />
                  {t.nav.admin}
                </Link>
              </DropdownMenuItem>
            </>
          ) : null}

          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={href('/profile/settings')}>
              <Settings aria-hidden="true" />
              {t.nav.settings}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            destructive
            onSelect={() => logout.mutate()}
            className={cn(logout.isPending && 'pointer-events-none opacity-60')}
          >
            <LogOut aria-hidden="true" />
            {t.nav.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
