import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthCard } from '@/features/auth/auth-card';
import { VerifyEmailPanel } from '@/features/auth/verify-email-panel';
import { resolveLocale } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.auth.verifyEmailTitle, robots: { index: false, follow: false } };
}

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { t } = await resolveLocale(params);

  return (
    <AuthCard title={t.auth.verifyEmailTitle}>
      <Suspense fallback={<div className="h-40" aria-hidden="true" />}>
        <VerifyEmailPanel />
      </Suspense>
    </AuthCard>
  );
}
