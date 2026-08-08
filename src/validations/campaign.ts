import { z } from 'zod';

import {
  communeIdSchema,
  paginationSchema,
  sanitizedText,
  uuidSchema,
  wilayaIdSchema,
} from './common';

export const campaignStatusSchema = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);

export const goalTypeSchema = z.enum(['MONETARY', 'MATERIAL']);

export const createCampaignSchema = z
  .object({
    title: sanitizedText(8, 140, 'Le titre'),
    summary: sanitizedText(20, 300, 'Le résumé'),
    description: sanitizedText(60, 8000, 'La description'),
    categoryId: uuidSchema,
    organizationId: uuidSchema,
    goalType: goalTypeSchema,
    targetAmount: z.coerce.number().positive().max(1_000_000_000).optional(),
    targetQuantity: z.coerce.number().int().positive().max(10_000_000).optional(),
    unitLabel: sanitizedText(1, 40, "L'unité").optional(),
    wilayaId: wilayaIdSchema.optional(),
    communeId: communeIdSchema.optional(),
    coverId: uuidSchema.optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    saveAsDraft: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.goalType === 'MONETARY' && !data.targetAmount) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetAmount'],
        message: 'Indiquez un objectif financier, ou choisissez un objectif matériel.',
      });
    }
    if (data.goalType === 'MATERIAL') {
      if (!data.targetQuantity) {
        ctx.addIssue({
          code: 'custom',
          path: ['targetQuantity'],
          message: 'Indiquez une quantité cible.',
        });
      }
      if (!data.unitLabel) {
        ctx.addIssue({
          code: 'custom',
          path: ['unitLabel'],
          message: 'Précisez l’unité (colis, bouteilles, cartables…).',
        });
      }
    }
    if (data.endDate && data.endDate <= data.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'La date de fin doit être postérieure à la date de début.',
      });
    }
  });

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const listCampaignsQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  wilayaId: wilayaIdSchema.optional(),
  categoryId: uuidSchema.optional(),
  organizationId: uuidSchema.optional(),
  status: campaignStatusSchema.optional(),
});

export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>;

export const campaignUpdateSchema = z.object({
  title: sanitizedText(5, 140, 'Le titre'),
  content: sanitizedText(20, 5000, 'Le contenu'),
  mediaIds: z.array(uuidSchema).max(8).optional(),
});

export const changeCampaignStatusSchema = z.object({
  status: campaignStatusSchema,
  reason: sanitizedText(3, 600, 'Le motif').optional(),
});
