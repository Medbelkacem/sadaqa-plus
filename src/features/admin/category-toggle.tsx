'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Switch } from '@/components/ui/misc';
import { useI18n } from '@/i18n/context';
import { ApiClientError, api } from '@/lib/api/client';

type Category = {
  id: string;
  kind: string;
  slug: string;
  nameFr: string;
  nameAr: string;
  nameEn: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
};

/**
 * Activates or deactivates a category.
 *
 * Deactivation removes it from the pickers used for new submissions; existing
 * records keep pointing at it, so nothing is orphaned and history stays
 * readable.
 */
export function CategoryToggle({ category }: { category: Category }) {
  const { t } = useI18n();
  const router = useRouter();

  const toggle = useMutation({
    mutationFn: (isActive: boolean) =>
      api.put('/api/admin/categories', {
        id: category.id,
        kind: category.kind,
        slug: category.slug,
        nameFr: category.nameFr,
        nameAr: category.nameAr,
        nameEn: category.nameEn,
        icon: category.icon ?? undefined,
        color: category.color ?? undefined,
        sortOrder: category.sortOrder,
        isActive,
      }),
    onSuccess: () => {
      toast.success(t.common.saved);
      router.refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : t.errors.genericBody),
  });

  return (
    <Switch
      checked={category.isActive}
      disabled={toggle.isPending}
      onCheckedChange={(checked) => toggle.mutate(checked)}
      aria-label={`${category.nameFr} — ${category.isActive ? t.common.published : t.common.draft}`}
    />
  );
}
