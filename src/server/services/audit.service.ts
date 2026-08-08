import 'server-only';

import type { AuditAction, Prisma, TargetType } from '@prisma/client';

import { prisma } from '@/server/db/prisma';
import { clientIp, clientUserAgent } from '@/server/auth/session';
import { hashIp } from '@/server/auth/tokens';

/**
 * Append-only audit trail for sensitive actions.
 *
 * Metadata is caller-supplied and must never contain passwords, tokens,
 * document contents or medical detail — `scrubMetadata` drops the obvious
 * offenders as a backstop.
 */

const FORBIDDEN_METADATA_KEYS = new Set([
  'password',
  'passwordhash',
  'newpassword',
  'currentpassword',
  'token',
  'tokenhash',
  'secret',
  'authorization',
  'cookie',
  'sessionid',
  'twofactorsecret',
  'attendancesecret',
]);

function scrubMetadata(input: Record<string, unknown> | undefined) {
  if (!input) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) {
      out[key] = '[redacted]';
      continue;
    }
    if (typeof value === 'string' && value.length > 512) {
      out[key] = `${value.slice(0, 512)}…`;
      continue;
    }
    out[key] = value;
  }
  return out as Prisma.InputJsonValue;
}

export type AuditInput = {
  actorId?: string | null;
  action: AuditAction;
  targetType?: TargetType | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  /** Pass a transaction client to make the log atomic with the change it records. */
  tx?: Prisma.TransactionClient;
};

export async function recordAudit(input: AuditInput) {
  const client = input.tx ?? prisma;

  // Request headers are unavailable in background jobs; degrade quietly.
  let ipHash: string | null = null;
  let userAgent: string | null = null;
  try {
    ipHash = hashIp(await clientIp());
    userAgent = await clientUserAgent();
  } catch {
    /* not in a request context */
  }

  try {
    await client.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: scrubMetadata(input.metadata),
        ipHash,
        userAgent,
      },
    });
  } catch (error) {
    // Losing an audit row must never fail the user-facing operation, but it is
    // an operational incident and is logged as such.
    console.error('[audit] failed to write audit entry', {
      action: input.action,
      error,
    });
  }
}
