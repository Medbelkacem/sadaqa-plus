import { z } from 'zod';

import { emailSchema, algerianPhoneSchema } from './auth';
import { sanitizedText, uuidSchema } from './common';

export const targetTypeSchema = z.enum([
  'REQUEST',
  'CAMPAIGN',
  'EVENT',
  'ORGANIZATION',
  'USER',
  'MESSAGE',
  'MISSION',
  'DONATION',
  'CONVERSATION',
]);

export const toggleSavedSchema = z.object({
  targetType: z.enum(['REQUEST', 'CAMPAIGN', 'EVENT']),
  targetId: uuidSchema,
});

export const createReportSchema = z.object({
  targetType: targetTypeSchema,
  targetId: uuidSchema,
  reason: z.enum([
    'FRAUD',
    'DUPLICATE',
    'INAPPROPRIATE',
    'MISLEADING',
    'HARASSMENT',
    'PRIVACY',
    'OTHER',
  ]),
  description: sanitizedText(10, 2000, 'La description').optional(),
});

export const resolveReportSchema = z
  .object({
    status: z.enum(['UNDER_REVIEW', 'ACTION_TAKEN', 'DISMISSED']),
    resolution: sanitizedText(5, 1000, 'La résolution').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status !== 'UNDER_REVIEW' && !data.resolution) {
      ctx.addIssue({
        code: 'custom',
        path: ['resolution'],
        message: 'Documentez la décision prise.',
      });
    }
  });

export const donationIntentSchema = z
  .object({
    campaignId: uuidSchema.optional(),
    requestId: uuidSchema.optional(),
    kind: z.enum(['MONETARY', 'MATERIAL']).default('MATERIAL'),
    amount: z.coerce.number().positive().max(1_000_000_000).optional(),
    quantity: z.coerce.number().int().positive().max(10_000_000).optional(),
    unitLabel: sanitizedText(1, 40, "L'unité").optional(),
    message: sanitizedText(5, 1000, 'Le message').optional(),
    contactEmail: emailSchema.optional(),
    contactPhone: algerianPhoneSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.campaignId && !data.requestId) {
      ctx.addIssue({
        code: 'custom',
        path: ['campaignId'],
        message: 'Indiquez une campagne ou une demande.',
      });
    }
    if (data.kind === 'MATERIAL' && !data.quantity && !data.message) {
      ctx.addIssue({
        code: 'custom',
        path: ['message'],
        message: 'Précisez ce que vous pouvez apporter.',
      });
    }
  });

export type DonationIntentInput = z.infer<typeof donationIntentSchema>;

export const startDonationSchema = z.object({
  campaignId: uuidSchema,
  amount: z.coerce.number().positive().max(1_000_000_000),
  isAnonymous: z.boolean().default(true),
});
