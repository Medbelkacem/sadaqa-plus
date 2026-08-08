import 'server-only';

import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

// `promisify` resolves to the 3-argument overload; re-type it so the tuning
// parameters can be passed explicitly.
const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Password hashing with scrypt (RFC 7914), an OWASP-approved memory-hard KDF
 * available in the Node standard library. No native module is required, so the
 * same code runs identically in Docker, on Vercel and in CI.
 *
 * Parameters are stored inside the hash string, which makes it possible to
 * raise the cost later and transparently re-hash on next successful login
 * (see `needsRehash`).
 *
 *   scrypt$N$r$p$<salt base64url>$<derived key base64url>
 */

const CURRENT = {
  N: 1 << 15, // 32768 iterations -> ~32 MiB of memory per hash
  r: 8,
  p: 2,
  keyLength: 64,
  saltLength: 16,
} as const;

// scrypt memory use is roughly 128 * N * r bytes; give the call explicit headroom.
const maxmem = 256 * CURRENT.N * CURRENT.r;

function encode(N: number, r: number, p: number, salt: Buffer, key: Buffer) {
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

type ParsedHash = { N: number; r: number; p: number; salt: Buffer; key: Buffer };

function decode(stored: string): ParsedHash | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return null;
  // Refuse absurd parameters from a tampered row rather than letting scrypt
  // allocate unbounded memory.
  if (N < 1024 || N > 1 << 20 || r < 1 || r > 32 || p < 1 || p > 16) return null;

  try {
    return {
      N,
      r,
      p,
      salt: Buffer.from(parts[4], 'base64url'),
      key: Buffer.from(parts[5], 'base64url'),
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(CURRENT.saltLength);
  const key = (await scrypt(password.normalize('NFKC'), salt, CURRENT.keyLength, {
    N: CURRENT.N,
    r: CURRENT.r,
    p: CURRENT.p,
    maxmem,
  })) as Buffer;
  return encode(CURRENT.N, CURRENT.r, CURRENT.p, salt, key);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = decode(stored);
  if (!parsed) return false;

  const candidate = (await scrypt(password.normalize('NFKC'), parsed.salt, parsed.key.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
    maxmem: Math.max(maxmem, 256 * parsed.N * parsed.r),
  })) as Buffer;

  if (candidate.length !== parsed.key.length) return false;
  return timingSafeEqual(candidate, parsed.key);
}

/** True when a stored hash uses weaker parameters than the current policy. */
export function needsRehash(stored: string): boolean {
  const parsed = decode(stored);
  if (!parsed) return true;
  return parsed.N < CURRENT.N || parsed.r < CURRENT.r || parsed.p < CURRENT.p;
}

/**
 * A pre-computed hash of a random value, used to keep the login path's timing
 * constant when the email does not exist. Without this, response time leaks
 * whether an account is registered.
 */
let dummyHashPromise: Promise<string> | null = null;

export async function burnDummyHash() {
  dummyHashPromise ??= hashPassword(randomBytes(24).toString('base64url'));
  const dummy = await dummyHashPromise;
  await verifyPassword('sadaqa-timing-equaliser', dummy);
}
