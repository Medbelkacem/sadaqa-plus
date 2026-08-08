import { z } from 'zod';

import {
  communeIdSchema,
  paginationSchema,
  sanitizedText,
  uuidSchema,
  wilayaIdSchema,
} from './common';

/**
 * Volunteer profile.
 *
 * Only fields an organisation actually needs to assign a mission. There is
 * deliberately no age, gender, health or family-status field.
 */
export const volunteerProfileSchema = z.object({
  skills: z.array(sanitizedText(2, 60, 'La compétence)')).max(20).default([]),
  languages: z.array(z.enum(['ar', 'fr', 'en', 'ber', 'other'])).max(6).default([]),
  availability: z
    .array(z.enum(['WEEKDAY_MORNING', 'WEEKDAY_AFTERNOON', 'WEEKDAY_EVENING', 'WEEKEND', 'ON_CALL']))
    .max(6)
    .default([]),
  hasTransport: z.boolean().default(false),
  experience: sanitizedText(10, 2000, "L'expérience").optional(),
  preferredActivities: z.array(sanitizedText(2, 60, "L'activité")).max(12).default([]),
  wilayaId: wilayaIdSchema.optional(),
  communeId: communeIdSchema.optional(),
  isSearchable: z.boolean().default(true),
});

export type VolunteerProfileInput = z.infer<typeof volunteerProfileSchema>;

export const createMissionSchema = z
  .object({
    title: sanitizedText(8, 140, 'Le titre'),
    description: sanitizedText(40, 4000, 'La description'),
    categoryId: uuidSchema,
    organizationId: uuidSchema,
    campaignId: uuidSchema.optional(),
    volunteersNeeded: z.coerce.number().int().min(1).max(5000),
    wilayaId: wilayaIdSchema,
    communeId: communeIdSchema.optional(),
    venue: sanitizedText(3, 200, 'Le lieu').optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional(),
    requirements: sanitizedText(3, 2000, 'Les prérequis').optional(),
    saveAsDraft: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.endsAt && data.endsAt <= data.startsAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'La fin doit être postérieure au début.',
      });
    }
  });

export type CreateMissionInput = z.infer<typeof createMissionSchema>;

export const listMissionsQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  wilayaId: wilayaIdSchema.optional(),
  categoryId: uuidSchema.optional(),
  organizationId: uuidSchema.optional(),
});

export const applyToMissionSchema = z.object({
  message: sanitizedText(10, 1000, 'Le message').optional(),
});

export const decideApplicationSchema = z
  .object({
    decision: z.enum(['ACCEPTED', 'REJECTED']),
    note: sanitizedText(3, 600, 'La note').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'REJECTED' && !data.note) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'Indiquez brièvement le motif du refus.',
      });
    }
  });

export const logHoursSchema = z.object({
  hours: z.coerce.number().min(0).max(24 * 30),
});
