import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthCard } from '@/features/auth/auth-card';
import { ResetPasswordForm } from '@/features/auth/password-forms';
import { resolveLocale } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.auth.resetPasswordTitle, robots: { index: false, follow: false } };
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { t } = await resolveLocale(params);

  return (
    <AuthCard title={t.auth.resetPasswordTitle}>
      <Suspense fallback={<div className="h-56" aria-hidden="true" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
