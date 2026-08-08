import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FileText } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { resolveLocale } from '@/i18n/server';
import { prisma } from '@/server/db/prisma';

export const dynamic = 'force-dynamic';

const DOCS = ['terms', 'privacy', 'cookies', 'legal-notice', 'contact'] as const;
type Doc = (typeof DOCS)[number];

/** The system-setting key each document is stored under, once written. */
const SETTING_KEY: Record<Doc, string> = {
  terms: 'legal.terms.content',
  privacy: 'legal.privacy.content',
  cookies: 'legal.cookies.content',
  'legal-notice': 'legal.notice.content',
  contact: 'legal.contact.content',
};

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}): Promise<Metadata> {
  const { t } = await resolveLocale(params as Promise<{ locale: string }>);
  const { doc } = await params;

  const titles: Record<string, string> = {
    terms: t.legal.terms,
    privacy: t.legal.privacy,
    cookies: t.legal.cookies,
    'legal-notice': t.legal.legalNotice,
    contact: t.legal.contact,
  };

  return { title: titles[doc] ?? t.legal.legalNotice };
}

/**
 * Legal documents.
 *
 * These are NOT shipped with boilerplate text. A terms-of-service or privacy
 * policy that nobody wrote is worse than none: it makes commitments the
 * operator has not actually made, in a product handling data about vulnerable
 * people. Until the operator publishes real content through
 * /admin/settings, each page says plainly that it has not been published.
 */
export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}) {
  const { t } = await resolveLocale(params as Promise<{ locale: string }>);
  const { doc } = await params;

  if (!DOCS.includes(doc as Doc)) notFound();

  const titles: Record<Doc, string> = {
    terms: t.legal.terms,
    privacy: t.legal.privacy,
    cookies: t.legal.cookies,
    'legal-notice': t.legal.legalNotice,
    contact: t.legal.contact,
  };

  const setting = await prisma.systemSetting.findUnique({
    where: { key: SETTING_KEY[doc as Doc] },
    select: { value: true, updatedAt: true },
  });

  const content = typeof setting?.value === 'string' ? setting.value : null;

  return (
    <>
      <PageHeader title={titles[doc as Doc]} />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {content ? (
          <article className="whitespace-pre-line text-[15px] leading-relaxed text-foreground">
            {content}
          </article>
        ) : (
          <div className="space-y-6">
            <EmptyState
              icon={FileText}
              title={t.legal.notPublished}
              description={t.legal.notPublishedBody}
            />
            <Alert tone="neutral">{t.legal.noCharityClaim}</Alert>
          </div>
        )}
      </div>
    </>
  );
}
