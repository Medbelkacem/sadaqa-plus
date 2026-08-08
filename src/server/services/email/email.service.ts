import 'server-only';

import type { Locale } from '@prisma/client';
import nodemailer, { type Transporter } from 'nodemailer';

import { serverEnv } from '@/config/env';
import { prisma } from '@/server/db/prisma';

import { renderTemplate, type TemplateKey, type TemplateVars } from './templates';

/**
 * Transactional email with a driver boundary.
 *
 * `smtp`  — real delivery through a configured SMTP server.
 * `log`   — development driver. Renders the message and writes it to the
 *           server log. It never claims delivery: the outbox row records the
 *           driver used, so nothing in the product can pretend an email was
 *           sent when SMTP is not configured.
 *
 * Every send is journalled in `outbox_messages` first, then attempted. A
 * failure leaves the row unsent with the error recorded, which the retry cron
 * picks up.
 */

let transporter: Transporter | null = null;

function smtpTransport(): Transporter | null {
  const env = serverEnv();
  if (env.EMAIL_DRIVER !== 'smtp' || !env.EMAIL_SERVER) return null;
  transporter ??= nodemailer.createTransport(env.EMAIL_SERVER);
  return transporter;
}

export function emailConfigured() {
  const env = serverEnv();
  return env.EMAIL_DRIVER === 'smtp' && Boolean(env.EMAIL_SERVER);
}

export type SendEmailInput = {
  to: string;
  template: TemplateKey;
  locale: Locale;
  vars: TemplateVars & { actionUrl?: string };
};

export async function sendEmail(input: SendEmailInput): Promise<{ queued: boolean; delivered: boolean }> {
  const env = serverEnv();
  const rendered = renderTemplate(input.template, input.locale, input.vars);

  const outbox = await prisma.outboxMessage.create({
    data: {
      channel: 'EMAIL',
      recipient: input.to,
      templateKey: input.template,
      // Rendered subject only. Body is regenerated on retry from the template
      // so no personal content is duplicated into a long-lived queue row.
      payload: {
        locale: input.locale,
        subject: rendered.subject,
        vars: input.vars as Record<string, string>,
      },
    },
    select: { id: true },
  });

  const transport = smtpTransport();

  if (!transport) {
    console.info(
      `[email:${env.EMAIL_DRIVER}] to=${input.to} template=${input.template} subject="${rendered.subject}"\n${rendered.text}\n`,
    );
    await prisma.outboxMessage.update({
      where: { id: outbox.id },
      data: {
        attempts: { increment: 1 },
        lastError: 'SMTP not configured — rendered to server log only (EMAIL_DRIVER=log).',
      },
    });
    return { queued: true, delivered: false };
  }

  try {
    await transport.sendMail({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    await prisma.outboxMessage.update({
      where: { id: outbox.id },
      data: { sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
    });

    return { queued: true, delivered: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SMTP error';
    console.error('[email] delivery failed', { template: input.template, message });
    await prisma.outboxMessage.update({
      where: { id: outbox.id },
      data: { attempts: { increment: 1 }, lastError: message.slice(0, 500) },
    });
    return { queued: true, delivered: false };
  }
}

/** Retries unsent outbox rows. Invoked by the scheduled job, never inline. */
export async function flushOutbox(limit = 50) {
  if (!emailConfigured()) return { attempted: 0, delivered: 0, skipped: true };

  const pending = await prisma.outboxMessage.findMany({
    where: { channel: 'EMAIL', sentAt: null, attempts: { lt: 5 }, scheduledFor: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let delivered = 0;
  const transport = smtpTransport();
  if (!transport) return { attempted: 0, delivered: 0, skipped: true };

  for (const row of pending) {
    const payload = row.payload as { locale: Locale; vars: TemplateVars & { actionUrl?: string } };
    const rendered = renderTemplate(row.templateKey as TemplateKey, payload.locale, payload.vars);
    try {
      await transport.sendMail({
        from: serverEnv().EMAIL_FROM,
        to: row.recipient,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      await prisma.outboxMessage.update({
        where: { id: row.id },
        data: { sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
      });
      delivered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SMTP error';
      await prisma.outboxMessage.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 }, lastError: message.slice(0, 500) },
      });
    }
  }

  return { attempted: pending.length, delivered, skipped: false };
}
