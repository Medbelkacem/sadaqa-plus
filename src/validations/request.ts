import { z } from 'zod';

import { algerianPhoneSchema, emailSchema } from './auth';
import {
  algeriaLatitude,
  algeriaLongitude,
  communeIdSchema,
  csvOf,
  paginationSchema,
  sanitizedText,
  uuidSchema,
  wilayaIdSchema,
} from './common';

export const urgencySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const locationPrecisionSchema = z.enum(['EXACT', 'APPROXIMATE', 'COMMUNE_ONLY']);
export const contactMethodSchema = z.enum(['PLATFORM', 'EMAIL', 'PHONE', 'WHATSAPP']);

export const requestStatusSchema = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'UNDER_REVIEW',
  'VERIFIED',
  'ACTIVE',
  'PARTIALLY_HELPED',
  'COMPLETED',
  'REJECTED',
  'EXPIRED',
  'ARCHIVED',
]);

/**
 * Request creation payload.
 *
 * Contact details are conditionally required: choosing PHONE without giving a
 * number would publish a request nobody can act on.
 */
export const createRequestSchema = z
  .object({
    title: sanitizedText(10, 140, 'Le titre'),
    description: sanitizedText(40, 5000, 'La description'),
    categoryId: uuidSchema,
    urgency: urgencySchema.default('MEDIUM'),
    quantity: sanitizedText(1, 120, 'La quantité').optional(),
    beneficiaryCount: z.coerce.number().int().min(1).max(1_000_000).optional(),

    organizationId: uuidSchema.optional(),

    wilayaId: wilayaIdSchema,
    communeId: communeIdSchema.optional(),
    addressPrivate: sanitizedText(3, 300, "L'adresse").optional(),
    locationPrecision: locationPrecisionSchema.default('COMMUNE_ONLY'),
    latitude: algeriaLatitude.optional(),
    longitude: algeriaLongitude.optional(),

    contactMethod: contactMethodSchema.default('PLATFORM'),
    contactPhone: algerianPhoneSchema.optional(),
    contactEmail: emailSchema.optional(),
    contactWhatsapp: algerianPhoneSchema.optional(),
    contactPublic: z.boolean().default(false),

    attachmentIds: z.array(uuidSchema).max(6).default([]),

    /** true = save as DRAFT, false/absent = submit for review. */
    saveAsDraft: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.contactMethod === 'PHONE' && !data.contactPhone) {
      ctx.addIssue({
        code: 'custom',
        path: ['contactPhone'],
        message: 'Un numéro de téléphone est requis pour cette méthode de contact.',
      });
    }
    if (data.contactMethod === 'WHATSAPP' && !data.contactWhatsapp) {
      ctx.addIssue({
        code: 'custom',
        path: ['contactWhatsapp'],
        message: 'Un numéro WhatsApp est requis pour cette méthode de contact.',
      });
    }
    if (data.contactMethod === 'EMAIL' && !data.contactEmail) {
      ctx.addIssue({
        code: 'custom',
        path: ['contactEmail'],
        message: 'Une adresse e-mail est requise pour cette méthode de contact.',
      });
    }
    // An exact pin is meaningless without coordinates, and publishing an exact
    // home location is exactly what the privacy rules forbid by default.
    if (data.locationPrecision === 'EXACT' && (!data.latitude || !data.longitude)) {
      ctx.addIssue({
        code: 'custom',
        path: ['locationPrecision'],
        message: 'Sélectionnez un point sur la carte ou choisissez une précision approximative.',
      });
    }
  });

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const updateRequestSchema = createRequestSchema;

export const listRequestsQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  wilayaId: wilayaIdSchema.optional(),
  communeId: communeIdSchema.optional(),
  categoryId: uuidSchema.optional(),
  categories: csvOf(z.string().uuid()),
  urgency: urgencySchema.optional(),
  organizationId: uuidSchema.optional(),
  status: requestStatusSchema.optional(),
  verifiedOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  sort: z.enum(['recent', 'urgency', 'oldest']).default('recent'),
});

export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;

/** Moderator decision payload. */
export const moderateRequestSchema = z
  .object({
    action: z.enum(['start_review', 'verify', 'publish', 'reject', 'archive', 'expire']),
    reason: sanitizedText(5, 1000, 'Le motif').optional(),
    evidenceRef: z.string().trim().max(300).optional(),
  })
  .superRefine((data, ctx) => {
    // A rejection that a beneficiary cannot act on is worse than no decision.
    if (data.action === 'reject' && !data.reason) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Un motif est obligatoire pour un refus.',
      });
    }
  });

export type ModerateRequestInput = z.infer<typeof moderateRequestSchema>;

/** Author-driven progress updates. */
export const updateRequestProgressSchema = z.object({
  status: z.enum(['PARTIALLY_HELPED', 'COMPLETED', 'ACTIVE']),
  note: sanitizedText(3, 1000, 'La note').optional(),
});
