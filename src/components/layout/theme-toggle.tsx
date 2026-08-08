'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useHydrated } from '@/hooks/use-hydrated';
import { useI18n } from '@/i18n/context';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  // The stored preference is unknown during SSR; render a stable placeholder
  // until hydration so the icon does not flip after paint.
  const mounted = useHydrated();

  const options = [
    { value: 'light', label: t.common.themeLight, icon: Sun },
    { value: 'dark', label: t.common.themeDark, icon: Moon },
    { value: 'system', label: t.common.themeSystem, icon: Monitor },
  ] as const;

  const active = options.find((o) => o.value === theme) ?? options[2];
  const ActiveIcon = mounted ? active.icon : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-lg text-muted-fg transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        aria-label={t.common.theme}
      >
        <ActiveIcon className="size-[18px]" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => setTheme(value)}
            className={cn(mounted && theme === value && 'font-semibold text-primary')}
          >
            <Icon aria-hidden="true" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
