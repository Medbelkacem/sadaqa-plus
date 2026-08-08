import 'server-only';

import { createHash } from 'node:crypto';

import { errors } from '@/lib/api/errors';

import { redis } from './redis';

export type RateLimitRule = {
  /** Stable identifier used as the key prefix. */
  name: string;
  /** Maximum number of hits allowed inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

/**
 * Rate limit rules for every abusable surface.
 *
 * Windows are fixed rather than sliding: simpler, cheap in Redis, and adequate
 * for abuse prevention at this scale.
 */
export const RATE_LIMITS = {
  login: { name: 'login', limit: 8, windowSeconds: 15 * 60 },
  register: { name: 'register', limit: 5, windowSeconds: 60 * 60 },
  passwordReset: { name: 'password-reset', limit: 5, windowSeconds: 60 * 60 },
  emailVerification: { name: 'email-verification', limit: 5, windowSeconds: 60 * 60 },
  requestCreate: { name: 'request-create', limit: 5, windowSeconds: 60 * 60 },
  reportCreate: { name: 'report-create', limit: 10, windowSeconds: 60 * 60 },
  messageSend: { name: 'message-send', limit: 40, windowSeconds: 10 * 60 },
  fileUpload: { name: 'file-upload', limit: 30, windowSeconds: 60 * 60 },
  donationIntent: { name: 'donation-intent', limit: 15, windowSeconds: 60 * 60 },
  publicApi: { name: 'public-api', limit: 120, windowSeconds: 60 },
  search: { name: 'search', limit: 60, windowSeconds: 60 },
  contactReveal: { name: 'contact-reveal', limit: 30, windowSeconds: 60 * 60 },
  attendanceScan: { name: 'attendance-scan', limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  /** True when the check ran against the per-instance fallback, not Redis. */
  degraded: boolean;
};

// ---------------------------------------------------------------------------
// In-memory fallback
//
// Used only when REDIS_URL is unset. It is per-process, so with more than one
// application instance the effective limit is (limit x instances). This is
// documented in .env.example and surfaced in the admin system-health panel;
// it is never presented as equivalent to the Redis-backed limiter.
// ---------------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweepMemory(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of memoryBuckets) {
    if (bucket.resetAt <= now) memoryBuckets.delete(key);
  }
}

function consumeMemory(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  sweepMemory(now);

  const existing = memoryBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + rule.windowSeconds * 1000;
    memoryBuckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: rule.limit - 1,
      retryAfterSeconds: rule.windowSeconds,
      degraded: true,
    };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    allowed: existing.count <= rule.limit,
    remaining: Math.max(0, rule.limit - existing.count),
    retryAfterSeconds,
    degraded: true,
  };
}

// ---------------------------------------------------------------------------

function buildKey(rule: RateLimitRule, identifier: string) {
  // Identifiers can be IPs or emails — hash so no PII lands in Redis keys.
  const digest = createHash('sha256').update(identifier).digest('base64url').slice(0, 24);
  return `rl:${rule.name}:${digest}`;
}

export async function consume(
  rule: RateLimitRule,
  identifier: string,
): Promise<RateLimitResult> {
  const key = buildKey(rule, identifier);
  const client = redis();

  if (!client) return consumeMemory(key, rule);

  try {
    const pipeline = client.multi();
    pipeline.incr(key);
    pipeline.ttl(key);
    const replies = await pipeline.exec();

    const count = Number(replies?.[0]?.[1] ?? 0);
    let ttl = Number(replies?.[1]?.[1] ?? -1);

    if (count === 1 || ttl < 0) {
      await client.expire(key, rule.windowSeconds);
      ttl = rule.windowSeconds;
    }

    return {
      allowed: count <= rule.limit,
      remaining: Math.max(0, rule.limit - count),
      retryAfterSeconds: Math.max(1, ttl),
      degraded: false,
    };
  } catch (error) {
    console.error('[rate-limit] redis failure, using in-memory fallback:', error);
    return consumeMemory(key, rule);
  }
}

/** Consumes a slot and throws a 429 AppError when the limit is exceeded. */
export async function enforce(rule: RateLimitRule, identifier: string) {
  const result = await consume(rule, identifier);
  if (!result.allowed) throw errors.rateLimited(result.retryAfterSeconds);
  return result;
}

/** Clears a bucket, e.g. after a successful login. */
export async function reset(rule: RateLimitRule, identifier: string) {
  const key = buildKey(rule, identifier);
  const client = redis();
  if (client) {
    await client.del(key).catch(() => undefined);
    return;
  }
  memoryBuckets.delete(key);
}
