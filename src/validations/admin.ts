import { z } from 'zod';

import { paginationSchema, sanitizedText, uuidSchema } from './common';

export const roleNameSchema = z.enum([
  'USER',
  'DONOR',
  'VOLUNTEER',
  'ORGANIZATION',
  'MODERATOR',
  'ADMIN',
  'SUPER_ADMIN',
]);

export const userStatusSchema = z.enum([
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
]);

export const listUsersQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  status: userStatusSchema.optional(),
  role: roleNameSchema.optional(),
});

export const updateUserSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('grant_role'), role: roleNameSchema }),
  z.object({ op: z.literal('revoke_role'), role: roleNameSchema }),
  z.object({ op: z.literal('set_status'), status: userStatusSchema }),
]);

export const categorySchema = z.object({
  id: uuidSchema.optional(),
  kind: z.enum(['REQUEST', 'CAMPAIGN', 'EVENT', 'MISSION']),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Utilisez uniquement des minuscules, chiffres et tirets.'),
  nameFr: sanitizedText(2, 80, 'Le nom'),
  nameAr: sanitizedText(2, 80, 'Le nom'),
  nameEn: sanitizedText(2, 80, 'Le nom'),
  icon: z.string().trim().max(40).optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur hexadécimale attendue (#RRGGBB).')
    .optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(100),
  isActive: z.boolean().default(true),
});

export const updateSettingSchema = z.object({
  key: z.string().trim().min(3).max(120),
  // Settings are typed per key by their consumers; the envelope stays generic
  // so a new setting does not require a schema change here.
  value: z.unknown(),
});

export const listAuditQuerySchema = paginationSchema.extend({
  actorId: uuidSchema.optional(),
  action: z.string().trim().max(60).optional(),
});
