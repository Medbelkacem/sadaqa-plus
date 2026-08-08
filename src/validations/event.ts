import { z } from 'zod';

import {
  algeriaLatitude,
  algeriaLongitude,
  communeIdSchema,
  paginationSchema,
  sanitizedText,
  uuidSchema,
  wilayaIdSchema,
} from './common';

export const eventStatusSchema = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'ONGOING',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);

export const participantKindSchema = z.enum(['PARTICIPANT', 'VOLUNTEER', 'ORGANIZER']);

export const createEventSchema = z
  .object({
    title: sanitizedText(8, 140, 'Le titre'),
    summary: sanitizedText(20, 300, 'Le résumé'),
    description: sanitizedText(40, 8000, 'La description'),
    categoryId: uuidSchema,
    organizationId: uuidSchema.optional(),
    campaignId: uuidSchema.optional(),
    wilayaId: wilayaIdSchema,
    communeId: communeIdSchema.optional(),
    venue: sanitizedText(3, 200, 'Le lieu').optional(),
    latitude: algeriaLatitude.optional(),
    longitude: algeriaLongitude.optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    capacity: z.coerce.number().int().positive().max(100_000).optional(),
    volunteerSlots: z.coerce.number().int().positive().max(10_000).optional(),
    requirements: sanitizedText(3, 2000, 'Les prérequis').optional(),
    coverId: uuidSchema.optional(),
    saveAsDraft: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.endsAt <= data.startsAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'La fin doit être postérieure au début.',
      });
    }
    if (data.volunteerSlots && data.capacity && data.volunteerSlots > data.capacity) {
      ctx.addIssue({
        code: 'custom',
        path: ['volunteerSlots'],
        message: 'Le nombre de bénévoles ne peut pas dépasser la capacité totale.',
      });
    }
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const listEventsQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  wilayaId: wilayaIdSchema.optional(),
  categoryId: uuidSchema.optional(),
  organizationId: uuidSchema.optional(),
  status: eventStatusSchema.optional(),
  upcomingOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v !== 'false'),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

export const registerForEventSchema = z.object({
  kind: participantKindSchema.default('PARTICIPANT'),
  note: sanitizedText(2, 500, 'La note').optional(),
});

export const attendanceScanSchema = z.object({
  // Format is `<uuid>.<mac>`; the server re-derives and compares the MAC.
  code: z.string().trim().min(20).max(120),
});

export const eventReportSchema = z.object({
  content: sanitizedText(40, 8000, 'Le bilan'),
});
