'use client';

import * as React from 'react';
import Link from 'next/link';
import { Lock, Mail, MessageSquare, Phone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Dictionary } from '@/i18n';
import { useLocalizedHref } from '@/i18n/context';

/**
 * Contact panel.
 *
 * The server has already nulled every contact field unless the author
 * explicitly opted into publishing them, so this component cannot leak a
 * private number by rendering the wrong branch — there is nothing to render.
 * When nothing is public, it offers the platform message route instead.
 */
export function ContactPanel({
  request,
  authorName,
  t,
  authenticated,
}: {
  request: {
    id: string;
    contactPublic: boolean;
    contactMethod: string;
    contactPhone: string | null;
    contactEmail: string | null;
    contactWhatsapp: string | null;
  };
  authorName: string;
  t: Dictionary;
  authenticated: boolean;
}) {
  const href = useLocalizedHref();

  const channels = [
    request.contactPhone
      ? {
          key: 'phone',
          icon: Phone,
          label: request.contactPhone,
          url: `tel:${request.contactPhone}`,
        }
      : null,
    request.contactWhatsapp
      ? {
          key: 'whatsapp',
          icon: MessageSquare,
          label: 'WhatsApp',
          // wa.me needs an international number without the leading zero.
          url: `https://wa.me/${request.contactWhatsapp.replace(/^0/, '213').replace(/\D/g, '')}`,
        }
      : null,
    request.contactEmail
      ? {
          key: 'email',
          icon: Mail,
          label: request.contactEmail,
          url: `mailto:${request.contactEmail}`,
        }
      : null,
  ].filter(Boolean) as { key: string; icon: typeof Phone; label: string; url: string }[];

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
          {t.requests.contactTitle}
        </p>
        <p className="text-sm font-medium text-foreground">{authorName}</p>

        {channels.length > 0 ? (
          <ul className="space-y-2">
            {channels.map((channel) => (
              <li key={channel.key}>
                <a
                  href={channel.url}
                  target={channel.key === 'whatsapp' ? '_blank' : undefined}
                  rel={channel.key === 'whatsapp' ? 'noopener noreferrer' : undefined}
                  dir="ltr"
                  className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <channel.icon className="size-4 shrink-0 text-muted-fg" aria-hidden="true" />
                  <span className="truncate">{channel.label}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-start gap-2 rounded-lg bg-surface-muted px-3 py-2.5 text-xs leading-relaxed text-muted-fg">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t.requests.contactHidden}
          </p>
        )}

        <Button asChild block variant={channels.length > 0 ? 'secondary' : 'primary'}>
          <Link
            href={
              authenticated
                ? href(`/messages/new?request=${request.id}`)
                : href(`/auth/login?next=${encodeURIComponent(`/messages/new?request=${request.id}`)}`)
            }
          >
            <MessageSquare aria-hidden="true" />
            {t.requests.contactViaPlatform}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
