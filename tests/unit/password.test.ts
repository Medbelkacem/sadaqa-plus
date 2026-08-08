import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  // password.ts reads AUTH_SECRET only through other modules, but keep the
  // environment realistic so nothing falls back to a default.
  process.env.AUTH_SECRET ??= 'test-secret-at-least-32-characters-long-x';
});

const { hashPassword, needsRehash, verifyPassword } = await import('@/server/auth/password');

describe('password hashing', () => {
  it('produces a parameterised scrypt hash, never the plaintext', async () => {
    const hash = await hashPassword('une-phrase-de-passe-solide');

    expect(hash).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[\w-]+\$[\w-]+$/);
    expect(hash).not.toContain('une-phrase-de-passe-solide');
  });

  it('salts each hash independently', async () => {
    const [a, b] = await Promise.all([hashPassword('même-mot-de-passe'), hashPassword('même-mot-de-passe')]);
    expect(a).not.toBe(b);
  });

  it('verifies the correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('une-phrase-de-passe-solide');

    await expect(verifyPassword('une-phrase-de-passe-solide', hash)).resolves.toBe(true);
    await expect(verifyPassword('une-phrase-de-passe-solid', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });

  it('normalises unicode so an equivalent password still verifies', async () => {
    // "é" as a single code point vs. e + combining acute.
    const hash = await hashPassword('café-solidarité-2026');
    await expect(verifyPassword('café-solidarité-2026', hash)).resolves.toBe(true);
  });

  it('rejects a malformed or tampered stored hash instead of throwing', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('x', 'scrypt$0$0$0$aaaa$bbbb')).resolves.toBe(false);
    // Absurd parameters must not be honoured — that would let a tampered row
    // exhaust memory.
    await expect(verifyPassword('x', 'scrypt$99999999$99$99$aaaa$bbbb')).resolves.toBe(false);
  });

  it('flags hashes below the current cost policy for rehash', async () => {
    const current = await hashPassword('une-phrase-de-passe-solide');
    expect(needsRehash(current)).toBe(false);

    // A hash produced under weaker parameters.
    const weak = current.replace(/^scrypt\$\d+/, 'scrypt$16384');
    expect(needsRehash(weak)).toBe(true);
    expect(needsRehash('garbage')).toBe(true);
  });
});
