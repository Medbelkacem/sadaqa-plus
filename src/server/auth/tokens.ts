import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { serverEnv } from '@/config/env';

/**
 * Opaque secret handling.
 *
 * Session cookies and email links carry a high-entropy random secret. Only an
 * HMAC of that secret is ever written to the database, so a leaked database
 * dump cannot be replayed to impersonate a user or reset a password.
 */

const SECRET_BYTES = 32;

export function generateSecret() {
  return randomBytes(SECRET_BYTES).toString('base64url');
}

export function hashSecret(secret: string) {
  return createHmac('sha256', serverEnv().AUTH_SECRET).update(secret).digest('base64url');
}

export function safeEquals(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Non-reversible IP fingerprint for audit and abuse tracking.
 * We keep enough to correlate events without storing the address itself.
 */
export function hashIp(ip: string | null | undefined) {
  if (!ip) return null;
  return createHmac('sha256', serverEnv().AUTH_SECRET).update(`ip:${ip}`).digest('base64url').slice(0, 32);
}

/** Human-facing reference like `RQ-7F3K2A`, unique enough for support tickets. */
export function humanReference(prefix: string) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return `${prefix}-${out}`;
}
