import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { PartnerApplicationForm } from '@/features/organizations/partner-application-form';
import { resolveLocale } from '@/i18n/server';
import { getAuthContext } from '@/server/auth/context';
import { getWilayas } from '@/server/services/reference.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t, locale } = await resolveLocale(params);
  return {
    title: t.organizations.applyTitle,
    description: t.organizations.applySubtitle,
    alternates: { canonical: `/${locale}/organizations/apply` },
  };
}

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { t, href } = await resolveLocale(params);

  const auth = await getAuthContext();
  if (!auth) {
    redirect(`${href('/auth/login')}?next=${encodeURIComponent(href('/organizations/apply'))}`);
  }

  const wilayas = await getWilayas();

  return (
    <>
      <PageHeader
        title={t.organizations.applyTitle}
        description={t.organizations.applySubtitle}
      />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Alert tone="info" className="mb-6">
          {t.legal.noCharityClaim}
        </Alert>

        <PartnerApplicationForm wilayas={wilayas} />
      </div>
    </>
  );
}
