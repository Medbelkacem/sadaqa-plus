import { z } from 'zod';

import { paginationSchema, sanitizedText, uuidSchema } from './common';
import { targetTypeSchema } from './interaction';

export const openConversationSchema = z.object({
  recipientId: uuidSchema,
  targetType: targetTypeSchema.optional(),
  targetId: uuidSchema.optional(),
  subject: sanitizedText(3, 140, 'Le sujet').optional(),
});

export const sendMessageSchema = z.object({
  body: sanitizedText(1, 4000, 'Le message'),
  attachmentIds: z.array(uuidSchema).max(4).optional(),
});

export const listMessagesQuerySchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const moderateMessageSchema = z.object({
  reason: sanitizedText(3, 500, 'Le motif'),
});

export const blockUserSchema = z.object({
  userId: uuidSchema,
  reason: sanitizedText(3, 300, 'Le motif').optional(),
});

export const notificationPreferenceSchema = z.object({
  inAppEnabled: z.boolean().default(true),
  emailEnabled: z.boolean().default(true),
  pushEnabled: z.boolean().default(false),
  urgentNearby: z.boolean().default(true),
  mutedTypes: z.array(z.string().max(60)).max(40).default([]),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1024),
  keys: z.object({
    p256dh: z.string().min(10).max(400),
    auth: z.string().min(10).max(400),
  }),
});
