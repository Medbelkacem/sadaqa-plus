import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { resolveLocale } from '@/i18n/server';
import { requirePermission } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { listAllCategories } from '@/server/services/admin.service';
import { CategoryToggle } from '@/features/admin/category-toggle';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: `${t.admin.categories} · ${t.admin.title}`, robots: { index: false } };
}

export default async function AdminCategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { t } = await resolveLocale(params);
  await requirePermission(PERMISSIONS.CATEGORY_MANAGE);

  const categories = await listAllCategories();
  const grouped = ['REQUEST', 'CAMPAIGN', 'EVENT', 'MISSION'] as const;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.admin.categories}</h1>
        <p className="mt-1.5 text-sm text-muted-fg">
          {/* Deactivating hides a category from new submissions without
              orphaning the records already filed under it. */}
          {categories.length} · {t.common.all}
        </p>
      </header>

      {grouped.map((kind) => {
        const items = categories.filter((category) => category.kind === kind);
        if (items.length === 0) return null;

        return (
          <section key={kind}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-fg">{kind}</h2>

            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
              {items.map((category) => {
                const usage =
                  category._count.requests +
                  category._count.campaigns +
                  category._count.events +
                  category._count.missions;

                return (
                  <li key={category.id} className="flex items-center gap-4 p-4">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color ?? 'var(--border-strong)' }}
                      aria-hidden="true"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {category.nameFr}
                      </p>
                      <p className="truncate text-xs text-muted-fg">
                        {category.nameAr} · {category.nameEn} ·{' '}
                        <span className="font-mono">{category.slug}</span>
                      </p>
                    </div>

                    <Badge tone="neutral">{usage}</Badge>

                    <CategoryToggle
                      category={{
                        id: category.id,
                        kind: category.kind,
                        slug: category.slug,
                        nameFr: category.nameFr,
                        nameAr: category.nameAr,
                        nameEn: category.nameEn,
                        icon: category.icon,
                        color: category.color,
                        sortOrder: category.sortOrder,
                        isActive: category.isActive,
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
