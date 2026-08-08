import type { Metadata } from 'next';

import { Alert } from '@/components/ui/alert';
import { SettingsEditor } from '@/features/admin/settings-editor';
import { resolveLocale } from '@/i18n/server';
import { requirePermission } from '@/server/auth/guards';
import { PERMISSIONS } from '@/server/permissions/definitions';
import { listSettings } from '@/server/services/admin.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: `${t.admin.settings} · ${t.admin.title}`, robots: { index: false } };
}

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { t } = await resolveLocale(params);
  await requirePermission(PERMISSIONS.SETTING_MANAGE);

  const settings = await listSettings();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.admin.settings}</h1>
      </header>

      {/* The legal settings are the ones that must never be flipped casually. */}
      <Alert tone="warning" title={t.legal.legalNotice}>
        {t.legal.noCharityClaim}
      </Alert>

      <SettingsEditor
        settings={settings.map((setting) => ({
          key: setting.key,
          value: setting.value,
          description: setting.description,
          updatedAt: setting.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
