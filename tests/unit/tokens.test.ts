import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long-x';
  process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
});

const { generateSecret, hashSecret, hashIp, humanReference, safeEquals } = await import(
  '@/server/auth/tokens'
);

describe('opaque secrets', () => {
  it('generates high-entropy, URL-safe secrets', () => {
    const secret = generateSecret();

    expect(secret).toMatch(/^[\w-]+$/);
    // 32 random bytes in base64url.
    expect(secret.length).toBeGreaterThanOrEqual(43);
    expect(generateSecret()).not.toBe(secret);
  });

  it('stores only an HMAC, never the secret itself', () => {
    const secret = generateSecret();
    const hash = hashSecret(secret);

    expect(hash).not.toBe(secret);
    expect(hash).not.toContain(secret);
    // Deterministic, so a lookup by hash works.
    expect(hashSecret(secret)).toBe(hash);
  });

  it('produces different hashes for different secrets', () => {
    expect(hashSecret('a')).not.toBe(hashSecret('b'));
  });

  it('compares in constant time and rejects length mismatch', () => {
    expect(safeEquals('abcdef', 'abcdef')).toBe(true);
    expect(safeEquals('abcdef', 'abcdeg')).toBe(false);
    expect(safeEquals('abc', 'abcdef')).toBe(false);
  });
});

describe('hashIp', () => {
  it('is non-reversible and stable', () => {
    const hash = hashIp('41.100.0.1');

    expect(hash).not.toBeNull();
    expect(hash).not.toContain('41.100');
    expect(hashIp('41.100.0.1')).toBe(hash);
    expect(hashIp('41.100.0.2')).not.toBe(hash);
  });

  it('returns null for a missing address', () => {
    expect(hashIp(null)).toBeNull();
    expect(hashIp(undefined)).toBeNull();
  });
});

describe('humanReference', () => {
  it('builds an unambiguous, prefixed reference', () => {
    const reference = humanReference('RQ');

    expect(reference).toMatch(/^RQ-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    // The alphabet omits I, O, 0 and 1 so a reference read aloud or copied
    // from a screen is not ambiguous.
    expect(reference).not.toMatch(/[IO01]/);
  });
});
