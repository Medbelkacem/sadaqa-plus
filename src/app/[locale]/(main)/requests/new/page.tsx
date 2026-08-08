import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { RequestWizard } from '@/features/requests/request-wizard';
import { resolveLocale } from '@/i18n/server';
import { getAuthContext } from '@/server/auth/context';
import { getCategories, getWilayas } from '@/server/services/reference.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return {
    title: t.requests.createTitle,
    description: t.requests.createSubtitle,
    robots: { index: false, follow: true },
  };
}

export default async function NewRequestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { t, href } = await resolveLocale(params);

  // Publishing a request needs an account; sending someone into a seven-step
  // form only to reject it at the end would be hostile.
  const auth = await getAuthContext();
  if (!auth) {
    redirect(`${href('/auth/login')}?next=${encodeURIComponent(href('/requests/new'))}`);
  }

  const [wilayas, categories] = await Promise.all([getWilayas(), getCategories('REQUEST')]);

  return (
    <>
      <PageHeader title={t.requests.createTitle} description={t.requests.createSubtitle} />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {!auth.user.emailVerified ? (
          <Alert tone="warning" className="mb-6" title={t.auth.emailNotVerified}>
            {t.auth.verifyEmailPending}
          </Alert>
        ) : null}

        <RequestWizard wilayas={wilayas} categories={categories} />
      </div>
    </>
  );
}
