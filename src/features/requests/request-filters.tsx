'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Filter, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useI18n } from '@/i18n/context';
import { localizedName } from '@/i18n/format';
import type { CategoryOption, WilayaOption } from '@/server/services/reference.service';
import { cn } from '@/lib/utils';

type CommuneOption = { id: number; nameFr: string; nameAr: string; nameEn: string };

/**
 * URL-driven filters.
 *
 * State lives entirely in the query string, so a filtered view is
 * shareable, bookmarkable and survives a refresh — and the server component
 * above re-runs the query rather than the client filtering an already-fetched
 * page.
 */
export function RequestFilters({
  wilayas,
  categories,
}: {
  wilayas: WilayaOption[];
  categories: CategoryOption[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Keyed by wilaya so switching wilaya cannot briefly show the previous
  // wilaya's communes, and so no state has to be cleared from an effect.
  const [communesByWilaya, setCommunesByWilaya] = React.useState<
    Record<string, CommuneOption[]>
  >({});

  const currentWilaya = searchParams.get('wilayaId') ?? '';
  const currentCommune = searchParams.get('communeId') ?? '';
  const currentCategory = searchParams.get('categoryId') ?? '';
  const currentUrgency = searchParams.get('urgency') ?? '';
  const currentSort = searchParams.get('sort') ?? 'recent';
  const currentQuery = searchParams.get('q') ?? '';

  const activeCount = ['wilayaId', 'communeId', 'categoryId', 'urgency'].filter((key) =>
    searchParams.get(key),
  ).length;

  const communes = currentWilaya ? (communesByWilaya[currentWilaya] ?? []) : [];

  // Loading is derived, not stored: a wilaya is loading exactly while it has
  // no entry in the cache yet.
  const loadingCommunes = Boolean(currentWilaya) && !(currentWilaya in communesByWilaya);

  React.useEffect(() => {
    if (!currentWilaya) return;

    let cancelled = false;

    fetch(`/api/geo/communes?wilayaId=${currentWilaya}`)
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        setCommunesByWilaya((current) => ({
          ...current,
          // Cache the empty array on failure too, so a broken wilaya does not
          // spin forever.
          [currentWilaya]: payload?.success ? (payload.data as CommuneOption[]) : [],
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setCommunesByWilaya((current) => ({ ...current, [currentWilaya]: [] }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentWilaya]);

  function apply(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    // Any filter change resets to the first page; staying on page 7 of a
    // now-3-page result set shows an empty screen.
    params.delete('page');
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`);
  }

  const controls = (
    <div className="grid gap-4">
      <Field>
        <FieldLabel>{t.requests.wilaya}</FieldLabel>
        <Select
          value={currentWilaya}
          onChange={(event) => apply({ wilayaId: event.target.value, communeId: null })}
        >
          <option value="">{t.common.all}</option>
          {wilayas.map((wilaya) => (
            <option key={wilaya.id} value={wilaya.id}>
              {wilaya.code} — {localizedName(wilaya, locale)}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <FieldLabel>{t.requests.commune}</FieldLabel>
        <Select
          value={currentCommune}
          disabled={!currentWilaya || loadingCommunes}
          onChange={(event) => apply({ communeId: event.target.value })}
        >
          <option value="">{loadingCommunes ? t.common.loading : t.common.all}</option>
          {communes.map((commune) => (
            <option key={commune.id} value={commune.id}>
              {localizedName(commune, locale)}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <FieldLabel>{t.requests.category}</FieldLabel>
        <Select
          value={currentCategory}
          onChange={(event) => apply({ categoryId: event.target.value })}
        >
          <option value="">{t.common.all}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {localizedName(category, locale)}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <FieldLabel>{t.requests.urgency}</FieldLabel>
        <Select
          value={currentUrgency}
          onChange={(event) => apply({ urgency: event.target.value })}
        >
          <option value="">{t.common.all}</option>
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((level) => (
            <option key={level} value={level}>
              {t.requests.urgencyLevels[level]}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <FieldLabel>{t.common.sort}</FieldLabel>
        <Select value={currentSort} onChange={(event) => apply({ sort: event.target.value })}>
          <option value="recent">{t.common.updated}</option>
          <option value="urgency">{t.requests.urgency}</option>
          <option value="oldest">{t.common.created}</option>
        </Select>
      </Field>
    </div>
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get('q');
          apply({ q: typeof value === 'string' ? value : null });
        }}
        className="flex gap-2"
        role="search"
      >
        <Input
          name="q"
          type="search"
          defaultValue={currentQuery}
          placeholder={t.search.placeholder}
          aria-label={t.common.search}
        />
        <Button type="submit" variant="secondary">
          {t.common.search}
        </Button>

        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="lg:hidden">
              <Filter aria-hidden="true" />
              {activeCount > 0 ? (
                <span className="ms-0.5 rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-fg">
                  {activeCount}
                </span>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="end" closeLabel={t.common.close}>
            <SheetHeader>
              <SheetTitle className="text-base font-semibold">{t.common.filters}</SheetTitle>
            </SheetHeader>
            <SheetBody>{controls}</SheetBody>
            <SheetFooter>
              <Button
                variant="ghost"
                block
                onClick={() =>
                  apply({
                    wilayaId: null,
                    communeId: null,
                    categoryId: null,
                    urgency: null,
                    q: null,
                  })
                }
              >
                <X aria-hidden="true" />
                {t.common.clearFilters}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </form>

      <div className={cn('hidden lg:block')}>
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
          {controls}
          {activeCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              block
              className="mt-4"
              onClick={() =>
                apply({ wilayaId: null, communeId: null, categoryId: null, urgency: null })
              }
            >
              <X aria-hidden="true" />
              {t.common.clearFilters}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
