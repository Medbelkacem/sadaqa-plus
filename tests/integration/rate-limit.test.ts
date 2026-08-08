import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * PostgreSQL rate-limiter integration test.
 *
 * This is the store that actually runs in production while no Redis is
 * configured, so its atomicity is a security property, not a detail: if two
 * concurrent requests could each "reset" the window, an attacker could spread
 * login attempts across parallel connections and evade the limit entirely.
 *
 * The PostgreSQL store is exercised directly rather than through `consume()`,
 * so the result does not depend on whether a Redis URL happens to be present
 * in the developer's environment — the point is to prove this store is sound.
 *
 * Requires a live database. Skipped automatically when DATABASE_URL is absent
 * so the unit suite still runs anywhere.
 */

const hasDatabase = Boolean(process.env.DATABASE_URL);

beforeAll(() => {
  process.env.AUTH_SECRET ||= 'test-secret-at-least-32-characters-long-x';
  // Force the PostgreSQL path even if a Redis URL is present in the env.
  delete process.env.REDIS_URL;
});

const describeIfDatabase = hasDatabase ? describe : describe.skip;

describeIfDatabase('PostgreSQL rate limiter', () => {
  type Rule = { name: string; limit: number; windowSeconds: number };

  let consumePostgres: typeof import('@/server/rate-limit').consumePostgres;
  let buildKey: typeof import('@/server/rate-limit').buildKey;
  let reset: typeof import('@/server/rate-limit').reset;
  let pruneExpiredBuckets: typeof import('@/server/rate-limit').pruneExpiredBuckets;
  let prisma: typeof import('@/server/db/prisma').prisma;

  /** Hits the PostgreSQL store directly, by the same key the app would use. */
  let hit: (rule: Rule, identifier: string) => ReturnType<typeof consumePostgres>;

  beforeAll(async () => {
    const mod = await import('@/server/rate-limit');
    consumePostgres = mod.consumePostgres;
    buildKey = mod.buildKey;
    reset = mod.reset;
    pruneExpiredBuckets = mod.pruneExpiredBuckets;
    prisma = (await import('@/server/db/prisma')).prisma;
    hit = (rule, identifier) => consumePostgres(buildKey(rule, identifier), rule);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('lets exactly `limit` requests through under heavy concurrency', async () => {
    const rule = { name: 'test-concurrency', limit: 10, windowSeconds: 60 };
    await reset(rule, 'probe');

    // Four times the limit, all in flight at once.
    const results = await Promise.all(
      Array.from({ length: 40 }, () => hit(rule, 'probe')),
    );

    expect(results.every((r) => r.backend === 'postgres')).toBe(true);
    expect(results.filter((r) => r.allowed)).toHaveLength(rule.limit);

    await reset(rule, 'probe');
  });

  it('counts down `remaining` monotonically', async () => {
    const rule = { name: 'test-remaining', limit: 3, windowSeconds: 60 };
    await reset(rule, 'probe');

    const first = await hit(rule, 'probe');
    const second = await hit(rule, 'probe');
    const third = await hit(rule, 'probe');
    const fourth = await hit(rule, 'probe');

    expect([first.remaining, second.remaining, third.remaining]).toEqual([2, 1, 0]);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);

    await reset(rule, 'probe');
  });

  it('starts a fresh window once the old one elapses', async () => {
    const rule = { name: 'test-rollover', limit: 2, windowSeconds: 1 };
    await reset(rule, 'probe');

    await hit(rule, 'probe');
    await hit(rule, 'probe');
    expect((await hit(rule, 'probe')).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1400));

    const afterRollover = await hit(rule, 'probe');
    expect(afterRollover.allowed).toBe(true);
    expect(afterRollover.remaining).toBe(1);

    await reset(rule, 'probe');
  });

  it('keeps identifiers isolated from each other', async () => {
    const rule = { name: 'test-isolation', limit: 1, windowSeconds: 60 };
    await reset(rule, 'alice');
    await reset(rule, 'bob');

    expect((await hit(rule, 'alice')).allowed).toBe(true);
    expect((await hit(rule, 'alice')).allowed).toBe(false);
    // Bob's budget is untouched by Alice exhausting hers.
    expect((await hit(rule, 'bob')).allowed).toBe(true);

    await reset(rule, 'alice');
    await reset(rule, 'bob');
  });

  it('never writes the raw identifier into the key', async () => {
    const rule = { name: 'test-privacy', limit: 5, windowSeconds: 60 };
    const identifier = 'beneficiary@example.dz';
    await reset(rule, identifier);
    await hit(rule, identifier);

    const rows = await prisma.rateLimitBucket.findMany({
      where: { key: { startsWith: 'rl:test-privacy:' } },
      select: { key: true },
    });

    expect(rows.length).toBe(1);
    expect(rows[0].key).not.toContain('beneficiary');
    expect(rows[0].key).not.toContain('example.dz');

    await reset(rule, identifier);
  });

  it('prunes elapsed buckets', async () => {
    const rule = { name: 'test-prune', limit: 5, windowSeconds: 1 };
    await hit(rule, 'probe');

    await new Promise((resolve) => setTimeout(resolve, 1400));
    await pruneExpiredBuckets();

    const remaining = await prisma.rateLimitBucket.count({
      where: { key: { startsWith: 'rl:test-prune:' } },
    });
    expect(remaining).toBe(0);
  });
});
