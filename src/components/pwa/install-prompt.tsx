'use client';

import * as React from 'react';
import { Download, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand/logo';
import { useI18n } from '@/i18n/context';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'sadaqa-install-dismissed-until';
const SNOOZE_DAYS = 30;

/**
 * Install prompt.
 *
 * Deliberately unobtrusive: it only appears once the browser says the app is
 * actually installable, waits until the visitor has been on the page a moment,
 * and stays hidden for a month after "Later". It never blocks content.
 */
export function InstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    // Already installed — nothing to offer.
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (until > Date.now()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      // Let the visitor look at the page before asking for anything.
      window.setTimeout(() => setVisible(true), 8000);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  function snooze() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
    setDeferred(null);
  }

  if (!visible || !deferred) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="install-title"
      aria-describedby="install-body"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 animate-[var(--animate-fade-up)] rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-lifted)] sm:inset-x-auto sm:end-6 sm:bottom-6 sm:max-w-sm lg:bottom-6"
    >
      <button
        type="button"
        onClick={snooze}
        className="absolute end-2.5 top-2.5 rounded-md p-1.5 text-muted-fg transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t.common.close}
      >
        <X className="size-4" aria-hidden="true" />
      </button>

      <div className="flex items-start gap-3 pe-6">
        <LogoMark className="mt-0.5 size-9 shrink-0" />
        <div className="min-w-0">
          <p id="install-title" className="text-sm font-semibold text-foreground">
            {t.pwa.installTitle}
          </p>
          <p id="install-body" className="mt-1 text-sm leading-relaxed text-muted-fg">
            {t.pwa.installBody}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={install} className="flex-1">
          <Download aria-hidden="true" />
          {t.pwa.install}
        </Button>
        <Button size="sm" variant="ghost" onClick={snooze}>
          {t.pwa.later}
        </Button>
      </div>
    </div>
  );
}
