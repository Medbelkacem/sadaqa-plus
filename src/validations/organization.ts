import { z } from 'zod';

import { algerianPhoneSchema, emailSchema, nameSchema } from './auth';
import {
  communeIdSchema,
  optionalUrlSchema,
  paginationSchema,
  sanitizedText,
  uuidSchema,
  wilayaIdSchema,
} from './common';

export const partnerApplicationSchema = z.object({
  organizationName: sanitizedText(3, 160, "Le nom de l'organisation"),
  contactPersonName: sanitizedText(3, 120, 'Le nom du contact'),
  contactEmail: emailSchema,
  contactPhone: algerianPhoneSchema,
  wilayaId: wilayaIdSchema,
  areaOfWork: sanitizedText(3, 160, "Le domaine d'intervention"),
  description: sanitizedText(80, 3000, 'La description'),
  website: optionalUrlSchema,
  socialLinks: sanitizedText(3, 600, 'Les réseaux sociaux').optional(),
  registrationNumber: sanitizedText(2, 80, "Le numéro d'agrément").optional(),
  documentIds: z.array(uuidSchema).max(6).optional(),
  acceptTerms: z.literal(true, {
    message: 'Vous devez confirmer l’exactitude des informations fournies.',
  }),
});

export type PartnerApplicationInput = z.infer<typeof partnerApplicationSchema>;

export const decidePartnerApplicationSchema = z
  .object({
    decision: z.enum(['UNDER_REVIEW', 'APPROVED', 'REJECTED']),
    reason: sanitizedText(5, 1000, 'Le motif').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'REJECTED' && !data.reason) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Un motif est obligatoire pour un refus.',
      });
    }
  });

export type DecidePartnerApplicationInput = z.infer<typeof decidePartnerApplicationSchema>;

export const updateOrganizationSchema = z.object({
  publicName: sanitizedText(3, 160, 'Le nom public'),
  description: sanitizedText(60, 3000, 'La description'),
  email: emailSchema,
  phone: algerianPhoneSchema.optional(),
  website: optionalUrlSchema,
  facebook: optionalUrlSchema,
  instagram: optionalUrlSchema,
  linkedin: optionalUrlSchema,
  wilayaId: wilayaIdSchema.optional(),
  communeId: communeIdSchema.optional(),
  address: sanitizedText(3, 300, "L'adresse").optional(),
  areasOfWork: z.array(sanitizedText(2, 80, 'Le domaine')).max(10).default([]),
  logoId: uuidSchema.optional(),
  coverageWilayaIds: z.array(wilayaIdSchema).max(58).default([]),
});

export const listOrganizationsQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  wilayaId: wilayaIdSchema.optional(),
});

export const organizationMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
  title: nameSchema.optional(),
});

export const setVerificationSchema = z
  .object({
    decision: z.enum(['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED']),
    reason: sanitizedText(5, 1000, 'Le motif').optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.decision === 'REJECTED' || data.decision === 'SUSPENDED') && !data.reason) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Un motif est obligatoire pour cette décision.',
      });
    }
  });
