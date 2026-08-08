import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { AuthCard } from '@/features/auth/auth-card';
import { LoginForm } from '@/features/auth/login-form';
import { resolveLocale } from '@/i18n/server';
import { getAuthContext } from '@/server/auth/context';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.auth.loginTitle, robots: { index: false, follow: false } };
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { t, href } = await resolveLocale(params);

  // Someone already signed in has no business on the login page.
  const auth = await getAuthContext();
  if (auth) redirect(href('/dashboard'));

  return (
    <AuthCard
      title={t.auth.loginTitle}
      description={t.auth.loginSubtitle}
      footer={
        <>
          {t.auth.noAccount}{' '}
          <Link
            href={href('/auth/register')}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t.nav.register}
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="h-64" aria-hidden="true" />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
