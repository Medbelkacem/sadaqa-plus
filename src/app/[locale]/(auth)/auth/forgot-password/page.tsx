import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard } from '@/features/auth/auth-card';
import { ForgotPasswordForm } from '@/features/auth/password-forms';
import { resolveLocale } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.auth.forgotPasswordTitle, robots: { index: false, follow: false } };
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { t, href } = await resolveLocale(params);

  return (
    <AuthCard
      title={t.auth.forgotPasswordTitle}
      description={t.auth.forgotPasswordSubtitle}
      footer={
        <Link
          href={href('/auth/login')}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t.nav.login}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
