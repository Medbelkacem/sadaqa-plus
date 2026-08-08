import { redirect } from 'next/navigation';

import { AdminShell } from '@/features/admin/admin-shell';
import { resolveLocale } from '@/i18n/server';
import { getAuthContext } from '@/server/auth/context';
import { prisma } from '@/server/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * Administration shell.
 *
 * Authorization happens here on the server, on every request. The layout is
 * not a security boundary on its own — every admin API route re-checks the
 * specific permission it needs — but it stops a non-staff user from ever
 * rendering the area.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { t, href } = await resolveLocale(params);

  const auth = await getAuthContext();
  if (!auth) redirect(`${href('/auth/login')}?next=${encodeURIComponent(href('/admin'))}`);
  if (!auth.isStaff) redirect(href('/'));

  // Live queue sizes drive the sidebar badges, so a moderator sees what needs
  // attention before clicking anything.
  const [pendingRequests, pendingApplications, openReports] = await Promise.all([
    prisma.request.count({
      where: { deletedAt: null, status: { in: ['PENDING_REVIEW', 'UNDER_REVIEW'] } },
    }),
    prisma.partnerApplication.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
    prisma.report.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
  ]);

  return (
    <AdminShell
      permissions={[...auth.permissions]}
      displayName={auth.user.displayName}
      badges={{ requests: pendingRequests, applications: pendingApplications, reports: openReports }}
      labels={{
        title: t.admin.title,
        backToSite: t.nav.home,
      }}
    >
      {children}
    </AdminShell>
  );
}
