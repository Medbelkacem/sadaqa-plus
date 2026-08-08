import 'server-only';

import { createHash } from 'node:crypto';

import { errors } from '@/lib/api/errors';

import { prisma } from './db/prisma';
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
 * Windows are fixed rather than sliding: simpler, cheap to evaluate, and
 * adequate for abuse prevention at this scale.
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

/** Which store answered. Surfaced in the admin system-health panel. */
export type RateLimitBackend = 'redis' | 'postgres' | 'memory';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  backend: RateLimitBackend;
};

// ---------------------------------------------------------------------------
// In-memory store — last resort only
//
// Per-process, so with more than one instance the effective limit is
// (limit × instances). On serverless that is close to no limit at all. It is
// used only when both Redis and PostgreSQL are unreachable, so that a database
// blip degrades throughput rather than taking the site down.
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
    memoryBuckets.set(key, { count: 1, resetAt: now + rule.windowSeconds * 1000 });
    return {
      allowed: true,
      remaining: rule.limit - 1,
      retryAfterSeconds: rule.windowSeconds,
      backend: 'memory',
    };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= rule.limit,
    remaining: Math.max(0, rule.limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    backend: 'memory',
  };
}

// ---------------------------------------------------------------------------
// PostgreSQL store
// ---------------------------------------------------------------------------

/**
 * Increments a bucket atomically in one statement.
 *
 * Exported so the store can be exercised directly — by the integration suite,
 * which must prove atomicity regardless of whether Redis happens to be
 * configured, and by the admin health check.
 *
 * The CASE arms handle window rollover inside the same UPSERT, so two
 * concurrent requests can never both "reset" the window and each get a fresh
 * allowance. `RETURNING` gives back the post-increment state, so no second
 * read is needed.
 */
export async function consumePostgres(
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO rate_limit_buckets ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${rule.windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN rate_limit_buckets."resetAt" <= now() THEN 1
        ELSE rate_limit_buckets."count" + 1
      END,
      "resetAt" = CASE
        WHEN rate_limit_buckets."resetAt" <= now()
          THEN now() + make_interval(secs => ${rule.windowSeconds})
        ELSE rate_limit_buckets."resetAt"
      END
    RETURNING "count", "resetAt"
  `;

  const row = rows[0];
  if (!row) throw new Error('rate limit upsert returned no row');

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((new Date(row.resetAt).getTime() - Date.now()) / 1000),
  );

  return {
    allowed: row.count <= rule.limit,
    remaining: Math.max(0, rule.limit - row.count),
    retryAfterSeconds,
    backend: 'postgres',
  };
}

// ---------------------------------------------------------------------------

export function buildKey(rule: RateLimitRule, identifier: string) {
  // Identifiers can be IP addresses or emails — hash them so no personal data
  // is written into a key.
  const digest = createHash('sha256').update(identifier).digest('base64url').slice(0, 24);
  return `rl:${rule.name}:${digest}`;
}

/**
 * Consumes one slot.
 *
 * Store preference: Redis (fastest) → PostgreSQL (correct across instances) →
 * in-memory (last resort). The first two are both distributed; only the third
 * is per-instance, and it is reached only when the database is unreachable.
 */
export async function consume(
  rule: RateLimitRule,
  identifier: string,
): Promise<RateLimitResult> {
  const key = buildKey(rule, identifier);
  const client = redis();

  if (client) {
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
        backend: 'redis',
      };
    } catch (error) {
      console.error('[rate-limit] redis failed, falling back to postgres:', error);
    }
  }

  try {
    return await consumePostgres(key, rule);
  } catch (error) {
    console.error('[rate-limit] postgres failed, falling back to in-memory:', error);
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
  if (client) await client.del(key).catch(() => undefined);

  await prisma.rateLimitBucket.deleteMany({ where: { key } }).catch(() => undefined);
  memoryBuckets.delete(key);
}

/** Removes elapsed buckets. Called by the cleanup job. */
export async function pruneExpiredBuckets() {
  const result = await prisma.rateLimitBucket.deleteMany({
    where: { resetAt: { lt: new Date() } },
  });
  return result.count;
}
