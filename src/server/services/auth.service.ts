import 'server-only';

import type { Locale, TokenType } from '@prisma/client';

import { serverEnv } from '@/config/env';
import { errors } from '@/lib/api/errors';
import { prisma } from '@/server/db/prisma';
import { hashPassword, needsRehash, burnDummyHash, verifyPassword } from '@/server/auth/password';
import { createSession, destroySession, revokeAllSessions } from '@/server/auth/session';
import { generateSecret, hashSecret } from '@/server/auth/tokens';
import { RATE_LIMITS, enforce, reset } from '@/server/rate-limit';
import { recordAudit } from '@/server/services/audit.service';
import { sendEmail } from '@/server/services/email/email.service';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@/validations/auth';

/**
 * Authentication workflows.
 *
 * Design notes that matter for security:
 *  - Registration and password reset never reveal whether an email exists.
 *  - Failed logins are counted per account and the account locks temporarily.
 *  - Every token is stored only as an HMAC; the plaintext exists solely in the
 *    email link.
 *  - Changing a password revokes every other session.
 */

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 10;
const LOCK_DURATION_MS = 15 * 60 * 1000;

async function issueToken(userId: string, type: TokenType, ttlMs: number) {
  const secret = generateSecret();

  // One live token per purpose: issuing a new one invalidates the previous.
  await prisma.verificationToken.updateMany({
    where: { userId, type, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.verificationToken.create({
    data: {
      userId,
      type,
      tokenHash: hashSecret(secret),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });

  return secret;
}

async function consumeToken(secret: string, type: TokenType) {
  const token = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashSecret(secret) },
    select: { id: true, userId: true, type: true, expiresAt: true, consumedAt: true },
  });

  if (!token || token.type !== type) return null;
  if (token.consumedAt) return null;
  if (token.expiresAt.getTime() <= Date.now()) return null;

  // Atomic single-use: the update only matches while still unconsumed.
  const claimed = await prisma.verificationToken.updateMany({
    where: { id: token.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (claimed.count !== 1) return null;

  return token.userId;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export async function register(input: RegisterInput, ip: string) {
  await enforce(RATE_LIMITS.register, ip);

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    // Do not disclose that the address is taken. The owner of the address
    // receives an email telling them an account already exists.
    await sendEmail({
      to: input.email,
      template: 'email_verification',
      locale: input.locale as Locale,
      vars: {
        firstName: input.firstName,
        actionUrl: new URL('/auth/login', serverEnv().APP_URL).toString(),
      },
    }).catch(() => undefined);

    return { created: false as const };
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        locale: input.locale as Locale,
        status: 'PENDING_VERIFICATION',
        profile: {
          create: {
            firstName: input.firstName,
            lastName: input.lastName,
          },
        },
        notificationPreference: { create: {} },
      },
      select: { id: true, email: true, locale: true },
    });

    // Everyone starts with the base USER role. Elevated roles are granted
    // explicitly, never inferred from anything the client sent.
    const userRole = await tx.role.findUnique({ where: { name: 'USER' }, select: { id: true } });
    if (userRole) {
      await tx.userRole.create({ data: { userId: created.id, roleId: userRole.id } });
    }

    return created;
  });

  await recordAudit({
    actorId: user.id,
    action: 'USER_REGISTERED',
    targetType: 'USER',
    targetId: user.id,
  });

  const secret = await issueToken(user.id, 'EMAIL_VERIFICATION', EMAIL_VERIFICATION_TTL_MS);
  const actionUrl = new URL(
    `/auth/verify-email?token=${encodeURIComponent(secret)}`,
    serverEnv().APP_URL,
  ).toString();

  await sendEmail({
    to: user.email,
    template: 'email_verification',
    locale: user.locale,
    vars: { firstName: input.firstName, actionUrl },
  });

  return { created: true as const, userId: user.id };
}

export async function resendVerification(email: string, ip: string) {
  await enforce(RATE_LIMITS.emailVerification, `${ip}:${email}`);

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null, emailVerifiedAt: null },
    select: { id: true, email: true, locale: true, profile: { select: { firstName: true } } },
  });

  // Always report success — the response must not reveal account existence.
  if (!user) return;

  const secret = await issueToken(user.id, 'EMAIL_VERIFICATION', EMAIL_VERIFICATION_TTL_MS);
  await sendEmail({
    to: user.email,
    template: 'email_verification',
    locale: user.locale,
    vars: {
      firstName: user.profile?.firstName ?? '',
      actionUrl: new URL(
        `/auth/verify-email?token=${encodeURIComponent(secret)}`,
        serverEnv().APP_URL,
      ).toString(),
    },
  });
}

export async function verifyEmail(token: string) {
  const userId = await consumeToken(token, 'EMAIL_VERIFICATION');
  if (!userId) throw errors.validation('Ce lien de confirmation est invalide ou a expiré.');

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
    },
    select: { id: true, email: true, locale: true, profile: { select: { firstName: true } } },
  });

  await recordAudit({
    actorId: user.id,
    action: 'USER_EMAIL_VERIFIED',
    targetType: 'USER',
    targetId: user.id,
  });

  await sendEmail({
    to: user.email,
    template: 'welcome',
    locale: user.locale,
    vars: {
      firstName: user.profile?.firstName ?? '',
      actionUrl: new URL('/dashboard', serverEnv().APP_URL).toString(),
    },
  }).catch(() => undefined);

  return { userId: user.id };
}

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------

export async function login(input: LoginInput, ip: string) {
  await enforce(RATE_LIMITS.login, ip);
  await enforce(RATE_LIMITS.login, `email:${input.email}`);

  const user = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
    select: {
      id: true,
      passwordHash: true,
      status: true,
      failedLoginCount: true,
      lockedUntil: true,
      emailVerifiedAt: true,
    },
  });

  const invalid = () => errors.validation('Adresse e-mail ou mot de passe incorrect.');

  if (!user) {
    // Equalise timing so a missing account is indistinguishable from a wrong
    // password.
    await burnDummyHash();
    throw invalid();
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw errors.rateLimited(Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000));
  }

  const valid = await verifyPassword(input.password, user.passwordHash);

  if (!valid) {
    const failed = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_DURATION_MS) : null,
      },
    });
    await recordAudit({
      actorId: user.id,
      action: 'USER_LOGIN_FAILED',
      targetType: 'USER',
      targetId: user.id,
      metadata: { failedAttempts: failed },
    });
    throw invalid();
  }

  if (user.status === 'SUSPENDED') {
    throw errors.forbidden('Ce compte est suspendu. Contactez l’équipe Sadaqa+.');
  }
  if (user.status === 'DEACTIVATED') {
    throw errors.forbidden('Ce compte a été désactivé.');
  }

  // Opportunistic upgrade if the stored hash predates the current cost policy.
  const nextHash = needsRehash(user.passwordHash)
    ? await hashPassword(input.password)
    : undefined;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      ...(nextHash ? { passwordHash: nextHash } : {}),
    },
  });

  await reset(RATE_LIMITS.login, `email:${input.email}`);
  await createSession(user.id);
  await recordAudit({
    actorId: user.id,
    action: 'USER_LOGIN',
    targetType: 'USER',
    targetId: user.id,
  });

  return { userId: user.id, emailVerified: Boolean(user.emailVerifiedAt) };
}

export async function logout(userId?: string) {
  await destroySession();
  if (userId) {
    await recordAudit({
      actorId: userId,
      action: 'USER_LOGOUT',
      targetType: 'USER',
      targetId: userId,
    });
  }
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function requestPasswordReset(input: ForgotPasswordInput, ip: string) {
  await enforce(RATE_LIMITS.passwordReset, ip);
  await enforce(RATE_LIMITS.passwordReset, `email:${input.email}`);

  const user = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
    select: { id: true, email: true, locale: true, profile: { select: { firstName: true } } },
  });

  // Caller always sees the same outcome regardless of existence.
  if (!user) return;

  const secret = await issueToken(user.id, 'PASSWORD_RESET', PASSWORD_RESET_TTL_MS);

  await recordAudit({
    actorId: user.id,
    action: 'USER_PASSWORD_RESET_REQUESTED',
    targetType: 'USER',
    targetId: user.id,
  });

  await sendEmail({
    to: user.email,
    template: 'password_reset',
    locale: user.locale,
    vars: {
      firstName: user.profile?.firstName ?? '',
      actionUrl: new URL(
        `/auth/reset-password?token=${encodeURIComponent(secret)}`,
        serverEnv().APP_URL,
      ).toString(),
    },
  });
}

export async function resetPassword(input: ResetPasswordInput) {
  const userId = await consumeToken(input.token, 'PASSWORD_RESET');
  if (!userId) {
    throw errors.validation('Ce lien de réinitialisation est invalide ou a expiré.');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        // Completing a reset proves control of the mailbox.
        emailVerifiedAt: { set: new Date() },
        status: 'ACTIVE',
      },
      select: { id: true, email: true, locale: true, profile: { select: { firstName: true } } },
    });

    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return updated;
  });

  await recordAudit({
    actorId: user.id,
    action: 'USER_PASSWORD_CHANGED',
    targetType: 'USER',
    targetId: user.id,
    metadata: { via: 'reset-link' },
  });

  await sendEmail({
    to: user.email,
    template: 'password_changed',
    locale: user.locale,
    vars: { firstName: user.profile?.firstName ?? '' },
  }).catch(() => undefined);
}

export async function changePassword(
  userId: string,
  currentSessionId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, locale: true, passwordHash: true, profile: { select: { firstName: true } } },
  });
  if (!user) throw errors.unauthenticated();

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw errors.validation('Mot de passe actuel incorrect.', {
      currentPassword: ['Mot de passe actuel incorrect.'],
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  // Keep the caller signed in, drop every other device.
  await revokeAllSessions(userId, currentSessionId);

  await recordAudit({
    actorId: userId,
    action: 'USER_PASSWORD_CHANGED',
    targetType: 'USER',
    targetId: userId,
    metadata: { via: 'account-settings' },
  });

  await sendEmail({
    to: user.email,
    template: 'password_changed',
    locale: user.locale,
    vars: { firstName: user.profile?.firstName ?? '' },
  }).catch(() => undefined);
}
