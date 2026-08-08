import { z } from 'zod';

/**
 * Authentication input contracts.
 *
 * These schemas are the single definition used by both the client form and the
 * server handler — the server always re-validates, never trusting that the
 * client ran the same check.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Adresse e-mail invalide.')
  .max(254, 'Adresse e-mail trop longue.')
  .email('Adresse e-mail invalide.');

/**
 * Password policy: length over composition rules, per NIST SP 800-63B.
 * A short list of obviously guessable values is rejected outright.
 */
const BANNED_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  'azertyuiop',
  'qwertyuiop',
  'motdepasse',
  'sadaqa123',
  'algerie123',
]);

export const passwordSchema = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères.')
  .max(200, 'Le mot de passe est trop long.')
  .refine((value) => !BANNED_PASSWORDS.has(value.toLowerCase()), {
    message: 'Ce mot de passe est trop courant. Choisissez-en un autre.',
  })
  .refine((value) => new Set(value).size > 3, {
    message: 'Ce mot de passe est trop répétitif.',
  });

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Ce champ doit contenir au moins 2 caractères.')
  .max(60, 'Ce champ est trop long.')
  .regex(
    /^[\p{L}\p{M}][\p{L}\p{M}\s'’-]*$/u,
    'Ce champ ne peut contenir que des lettres, espaces, apostrophes et tirets.',
  );

/** Algerian mobile/landline in national (0X XX XX XX XX) or +213 form. */
export const algerianPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, ''))
  .refine((value) => /^(?:\+213|00213|0)(?:5|6|7|[2-4]|9)\d{7,8}$/.test(value), {
    message: 'Numéro de téléphone algérien invalide.',
  });

export const localeSchema = z.enum(['AR', 'FR', 'EN']);

export const registerSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    locale: localeSchema.default('FR'),
    acceptTerms: z.literal(true, {
      message: 'Vous devez accepter les conditions d’utilisation.',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis.'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  });

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

/**
 * `RegisterFormValues` is what the *form* holds (defaults not yet applied);
 * `RegisterInput` is what the schema produces. react-hook-form needs both,
 * because a field with a Zod default is optional on input and required on
 * output.
 */
export type RegisterFormValues = z.input<typeof registerSchema>;
export type RegisterInput = z.output<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
