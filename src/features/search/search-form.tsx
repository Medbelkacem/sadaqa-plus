'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import { useI18n } from '@/i18n/context';

const KINDS = ['requests', 'campaigns', 'events', 'organizations'] as const;
type Kind = (typeof KINDS)[number];

/** Search state lives in the URL so a result page can be shared verbatim. */
export function SearchForm({
  defaultQuery,
  defaultKinds,
}: {
  defaultQuery: string;
  defaultKinds: Kind[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = React.useState(defaultQuery);
  const [kinds, setKinds] = React.useState<Kind[]>(defaultKinds);

  const labels: Record<Kind, string> = {
    requests: t.search.inRequests,
    campaigns: t.search.inCampaigns,
    events: t.search.inEvents,
    organizations: t.search.inOrganizations,
  };

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (kinds.length > 0 && kinds.length < KINDS.length) params.set('kinds', kinds.join(','));
    router.push(`${pathname}${params.toString() ? `?${params}` : ''}`);
  }

  return (
    <form onSubmit={submit} role="search" className="space-y-4">
      <div className="flex gap-2">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.search.placeholder}
          aria-label={t.common.search}
          autoFocus
        />
        <Button type="submit">{t.common.search}</Button>
      </div>

      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="sr-only">{t.search.allTypes}</legend>
        {KINDS.map((kind) => (
          <label key={kind} className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={kinds.length === 0 || kinds.includes(kind)}
              onCheckedChange={(checked) => {
                // An empty selection means "all", so unticking the last box
                // reads as all rather than none.
                const current = kinds.length === 0 ? [...KINDS] : kinds;
                setKinds(
                  checked === true
                    ? [...new Set([...current, kind])]
                    : current.filter((entry) => entry !== kind),
                );
              }}
            />
            {labels[kind]}
          </label>
        ))}
      </fieldset>
    </form>
  );
}
