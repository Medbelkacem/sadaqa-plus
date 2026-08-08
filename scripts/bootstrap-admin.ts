/**
 * Creates the first SUPER_ADMIN account.
 *
 * There is no default administrator baked into the seed and no well-known
 * password anywhere in this repository. The very first admin is created here,
 * once, from credentials supplied through the environment:
 *
 *   BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... npm run bootstrap:admin
 *
 * or interactively, which never puts the password in shell history:
 *
 *   BOOTSTRAP_ADMIN_EMAIL=... npm run bootstrap:admin
 *
 * Safety properties:
 *  - Refuses to run if an active SUPER_ADMIN already exists.
 *  - Enforces the same password policy as the public registration form.
 *  - Marks the address as verified (the operator controls it by definition).
 *  - Writes an audit entry recording the bootstrap.
 *  - Never prints the password.
 */

import { randomBytes, scrypt as scryptCb, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

import { PrismaClient } from '@prisma/client';

import { emailSchema, nameSchema, passwordSchema } from '../src/validations/auth';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const prisma = new PrismaClient();

// Mirrors src/server/auth/password.ts. Duplicated deliberately so this script
// stays runnable without pulling in the `server-only` module graph.
const PARAMS = { N: 1 << 15, r: 8, p: 2, keyLength: 64, saltLength: 16 };

async function hashPassword(password: string) {
  const salt = randomBytes(PARAMS.saltLength);
  const key = (await scrypt(password.normalize('NFKC'), salt, PARAMS.keyLength, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
    maxmem: 256 * PARAMS.N * PARAMS.r,
  })) as Buffer;
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

const KEY_CTRL_C = '\u0003';
const KEY_BACKSPACE = '\u007f';
const KEY_DELETE = '\b';

/** Reads a line from the terminal without echoing it. */
function promptHidden(question: string): Promise<string> {
  return new Promise<string>((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    let value = '';

    const finish = () => {
      stdin.setRawMode?.(false);
      stdin.pause();
      stdin.off('data', onData);
      process.stdout.write('\n');
      resolve(value);
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') return finish();
        if (char === KEY_CTRL_C) {
          process.stdout.write('\n');
          process.exit(130);
        }
        if (char === KEY_BACKSPACE || char === KEY_DELETE) {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
  });
}

async function main() {
  const existing = await prisma.user.count({
    where: {
      deletedAt: null,
      status: { in: ['ACTIVE', 'PENDING_VERIFICATION'] },
      roles: { some: { role: { name: 'SUPER_ADMIN' } } },
    },
  });

  if (existing > 0) {
    console.error(
      `Refusing to run: ${existing} active SUPER_ADMIN account(s) already exist.\n` +
        'Grant further admin roles from /admin/users instead.',
    );
    process.exitCode = 1;
    return;
  }

  const rawEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim() || 'Sadaqa';
  const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim() || 'Admin';

  if (!rawEmail) {
    console.error('BOOTSTRAP_ADMIN_EMAIL is required.');
    process.exitCode = 1;
    return;
  }

  const emailResult = emailSchema.safeParse(rawEmail);
  if (!emailResult.success) {
    console.error(`Invalid BOOTSTRAP_ADMIN_EMAIL: ${emailResult.error.issues[0]?.message}`);
    process.exitCode = 1;
    return;
  }

  for (const [label, value] of [
    ['BOOTSTRAP_ADMIN_FIRST_NAME', firstName],
    ['BOOTSTRAP_ADMIN_LAST_NAME', lastName],
  ] as const) {
    const result = nameSchema.safeParse(value);
    if (!result.success) {
      console.error(`Invalid ${label}: ${result.error.issues[0]?.message}`);
      process.exitCode = 1;
      return;
    }
  }

  const password =
    process.env.BOOTSTRAP_ADMIN_PASSWORD ??
    (process.stdin.isTTY ? await promptHidden('Password for the first administrator: ') : '');

  if (!password) {
    console.error(
      'No password supplied. Set BOOTSTRAP_ADMIN_PASSWORD or run this command in an interactive terminal.',
    );
    process.exitCode = 1;
    return;
  }

  const passwordResult = passwordSchema.safeParse(password);
  if (!passwordResult.success) {
    console.error('Password rejected by the platform policy:');
    for (const issue of passwordResult.error.issues) console.error(`  - ${issue.message}`);
    process.exitCode = 1;
    return;
  }

  const taken = await prisma.user.findUnique({
    where: { email: emailResult.data },
    select: { id: true },
  });
  if (taken) {
    console.error('An account already exists with this address.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);

  const roles = await prisma.role.findMany({
    where: { name: { in: ['USER', 'SUPER_ADMIN'] } },
    select: { id: true, name: true },
  });
  if (roles.length !== 2) {
    console.error('Roles are missing. Run `npm run db:seed` first.');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: emailResult.data,
        passwordHash,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        locale: 'FR',
        profile: { create: { firstName, lastName } },
        notificationPreference: { create: {} },
      },
      select: { id: true, email: true },
    });

    await tx.userRole.createMany({
      data: roles.map((role) => ({ userId: created.id, roleId: role.id })),
    });

    await tx.auditLog.create({
      data: {
        actorId: created.id,
        action: 'USER_ROLE_GRANTED',
        targetType: 'USER',
        targetId: created.id,
        metadata: { roles: ['USER', 'SUPER_ADMIN'], via: 'bootstrap:admin' },
      },
    });

    return created;
  });

  console.log(`Created SUPER_ADMIN ${user.email} (id ${user.id}).`);
  console.log('Remove BOOTSTRAP_ADMIN_* from the environment now — they are no longer needed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
