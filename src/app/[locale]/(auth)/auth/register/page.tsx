import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthCard } from '@/features/auth/auth-card';
import { RegisterForm } from '@/features/auth/register-form';
import { resolveLocale } from '@/i18n/server';
import { getAuthContext } from '@/server/auth/context';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.auth.registerTitle, robots: { index: false, follow: false } };
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { t, href } = await resolveLocale(params);

  const auth = await getAuthContext();
  if (auth) redirect(href('/dashboard'));

  return (
    <AuthCard
      title={t.auth.registerTitle}
      description={t.auth.registerSubtitle}
      footer={
        <>
          {t.auth.haveAccount}{' '}
          <Link
            href={href('/auth/login')}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t.nav.login}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
