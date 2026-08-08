import 'server-only';

import { z } from 'zod';

/**
 * Server environment. Parsed once, lazily, on first access.
 *
 * Validation is deliberately lazy: a production build (`next build`) must be
 * able to compile without a live database or secret store. Anything that
 * actually touches those resources reads `serverEnv()` at request time, which
 * is when the strict checks fire.
 */

const optionalString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal('').transform(() => undefined));

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url(),

  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET must be at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: optionalString,

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('.storage'),
  STORAGE_S3_BUCKET: optionalString,
  STORAGE_S3_REGION: optionalString,
  STORAGE_S3_ENDPOINT: optionalString,
  STORAGE_S3_ACCESS_KEY: optionalString,
  STORAGE_S3_SECRET_KEY: optionalString,
  STORAGE_S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

  EMAIL_DRIVER: z.enum(['log', 'smtp']).default('log'),
  EMAIL_FROM: z.string().default('Sadaqa+ <no-reply@localhost>'),
  EMAIL_SERVER: optionalString,

  PUSH_PUBLIC_KEY: optionalString,
  PUSH_PRIVATE_KEY: optionalString,
  PUSH_SUBJECT: z.string().default('mailto:contact@localhost'),

  PAYMENT_PROVIDER: z.enum(['none', 'satim', 'chargily']).default('none'),
  PAYMENT_PROVIDER_KEY: optionalString,
  PAYMENT_PROVIDER_SECRET: optionalString,
  PAYMENT_WEBHOOK_SECRET: optionalString,

  AI_PROVIDER: z.enum(['none', 'anthropic']).default('none'),
  AI_PROVIDER_KEY: optionalString,
  AI_MODEL: z.string().default('claude-sonnet-5'),

  CRON_SECRET: optionalString,
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

function read(): ServerEnv {
  const parsed = serverSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    AUTH_SECRET: process.env.AUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    STORAGE_LOCAL_DIR: process.env.STORAGE_LOCAL_DIR,
    STORAGE_S3_BUCKET: process.env.STORAGE_S3_BUCKET,
    STORAGE_S3_REGION: process.env.STORAGE_S3_REGION,
    STORAGE_S3_ENDPOINT: process.env.STORAGE_S3_ENDPOINT,
    STORAGE_S3_ACCESS_KEY: process.env.STORAGE_S3_ACCESS_KEY,
    STORAGE_S3_SECRET_KEY: process.env.STORAGE_S3_SECRET_KEY,
    STORAGE_S3_FORCE_PATH_STYLE: process.env.STORAGE_S3_FORCE_PATH_STYLE,
    EMAIL_DRIVER: process.env.EMAIL_DRIVER,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_SERVER: process.env.EMAIL_SERVER,
    PUSH_PUBLIC_KEY: process.env.PUSH_PUBLIC_KEY,
    PUSH_PRIVATE_KEY: process.env.PUSH_PRIVATE_KEY,
    PUSH_SUBJECT: process.env.PUSH_SUBJECT,
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    PAYMENT_PROVIDER_KEY: process.env.PAYMENT_PROVIDER_KEY,
    PAYMENT_PROVIDER_SECRET: process.env.PAYMENT_PROVIDER_SECRET,
    PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_PROVIDER_KEY: process.env.AI_PROVIDER_KEY,
    AI_MODEL: process.env.AI_MODEL,
    CRON_SECRET: process.env.CRON_SECRET,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Invalid server environment configuration:\n${issues}\n\nSee .env.example for the full list.`,
    );
  }

  return parsed.data;
}

export function serverEnv(): ServerEnv {
  cached ??= read();
  return cached;
}

/** Feature availability derived from configuration — never hardcoded. */
export function integrationStatus() {
  const env = serverEnv();
  return {
    redis: Boolean(env.REDIS_URL),
    objectStorage: env.STORAGE_DRIVER === 's3',
    email: env.EMAIL_DRIVER === 'smtp' && Boolean(env.EMAIL_SERVER),
    push: Boolean(env.PUSH_PUBLIC_KEY && env.PUSH_PRIVATE_KEY),
    payments: env.PAYMENT_PROVIDER !== 'none' && Boolean(env.PAYMENT_PROVIDER_KEY),
    ai: env.AI_PROVIDER !== 'none' && Boolean(env.AI_PROVIDER_KEY),
  } as const;
}

export type IntegrationStatus = ReturnType<typeof integrationStatus>;
