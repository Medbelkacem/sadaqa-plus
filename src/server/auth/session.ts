import 'server-only';

import { cookies, headers } from 'next/headers';

import { prisma } from '@/server/db/prisma';

import { generateSecret, hashIp, hashSecret } from './tokens';

export const SESSION_COOKIE = 'sadaqa_session';

/** Absolute session lifetime. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** How stale `lastSeenAt` may get before we refresh it (avoids a write per request). */
const TOUCH_INTERVAL_MS = 15 * 60 * 1000;

function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}

export async function clientIp(): Promise<string | null> {
  const store = await headers();
  const forwarded = store.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return store.get('x-real-ip');
}

export async function clientUserAgent(): Promise<string | null> {
  const store = await headers();
  return store.get('user-agent')?.slice(0, 255) ?? null;
}

export async function createSession(userId: string) {
  const secret = generateSecret();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSecret(secret),
      expiresAt,
      ipHash: hashIp(await clientIp()),
      userAgent: await clientUserAgent(),
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, secret, cookieOptions(expiresAt));

  return { expiresAt };
}

export type ActiveSession = {
  sessionId: string;
  userId: string;
  expiresAt: Date;
};

/**
 * Resolves the session cookie to a live session row.
 *
 * The cookie value itself is never trusted beyond being an opaque lookup key:
 * user identity comes from the database row, never from the client.
 */
export async function readSession(): Promise<ActiveSession | null> {
  const store = await cookies();
  const secret = store.get(SESSION_COOKIE)?.value;
  if (!secret) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSecret(secret) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      lastSeenAt: true,
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    // Best-effort: a failed touch must not break the request.
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  return { sessionId: session.id, userId: session.userId, expiresAt: session.expiresAt };
}

export async function destroySession() {
  const store = await cookies();
  const secret = store.get(SESSION_COOKIE)?.value;

  if (secret) {
    await prisma.session
      .updateMany({
        where: { tokenHash: hashSecret(secret), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }

  store.delete(SESSION_COOKIE);
}

/** Revokes every session for a user — used on password change and suspension. */
export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}
