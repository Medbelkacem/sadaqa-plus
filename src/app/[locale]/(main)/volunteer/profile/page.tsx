import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { VolunteerProfileForm } from '@/features/volunteer/volunteer-profile-form';
import { resolveLocale } from '@/i18n/server';
import { getAuthContext } from '@/server/auth/context';
import { getWilayas } from '@/server/services/reference.service';
import { getVolunteerProfile } from '@/server/services/volunteer.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params);
  return { title: t.volunteer.profileTitle, robots: { index: false, follow: false } };
}

export default async function VolunteerProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { t, href } = await resolveLocale(params);

  const auth = await getAuthContext();
  if (!auth) {
    redirect(`${href('/auth/login')}?next=${encodeURIComponent(href('/volunteer/profile'))}`);
  }

  const [wilayas, profile] = await Promise.all([
    getWilayas(),
    getVolunteerProfile(auth.user.id),
  ]);

  return (
    <>
      <PageHeader title={t.volunteer.profileTitle} description={t.volunteer.subtitle} />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <VolunteerProfileForm wilayas={wilayas} profile={profile} />
      </div>
    </>
  );
}
