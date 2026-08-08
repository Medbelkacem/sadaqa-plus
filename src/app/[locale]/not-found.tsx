import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { getDictionary } from '@/i18n';

/**
 * Locale-scoped 404.
 *
 * `notFound()` cannot read route params, so this renders in the platform's
 * default language. It stays deliberately minimal — no navigation chrome that
 * might itself need data.
 */
export default function LocaleNotFound() {
  const t = getDictionary('fr');

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />

      <div
        className="grid size-14 place-items-center rounded-2xl bg-surface-muted text-muted-fg"
        aria-hidden="true"
      >
        <FileQuestion className="size-6" />
      </div>

      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.errors.notFoundTitle}
        </h1>
        <p className="text-sm leading-relaxed text-muted-fg">{t.errors.notFoundBody}</p>
      </div>

      <Button asChild>
        <Link href="/">{t.errors.goHome}</Link>
      </Button>
    </div>
  );
}
