import { z } from 'zod';

/** Shared primitives used across every feature's input contract. */

export const uuidSchema = z.string().uuid('Identifiant invalide.');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const wilayaIdSchema = z.coerce.number().int().min(1).max(58);
export const communeIdSchema = z.coerce.number().int().min(1001).max(58999);

/**
 * Free text destined for public display.
 *
 * Output is escaped at render time by React, so this does not attempt to strip
 * markup. It removes control characters and zero-width characters, which are
 * used to smuggle invisible content past moderators and to spoof lookalike
 * text, and collapses runaway whitespace.
 */
export function sanitizedText(min: number, max: number, label = 'Ce champ') {
  return z
    .string()
    .trim()
    .transform((value) =>
      value
        // C0/C1 control characters, keeping newline and tab
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        // Zero-width characters, bidi overrides and the BOM: invisible to a
        // moderator but able to hide content or spoof lookalike text.
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, '')
        .replace(/[ \t]{3,}/g, '  ')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim(),
    )
    .pipe(
      z
        .string()
        .min(min, `${label} doit contenir au moins ${min} caractères.`)
        .max(max, `${label} ne peut pas dépasser ${max} caractères.`),
    );
}

export const optionalUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .or(z.literal('').transform(() => undefined))
  .refine(
    (value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        // Only web schemes: `javascript:` and `data:` links are XSS vectors
        // once rendered as an anchor.
        return url.protocol === 'https:' || url.protocol === 'http:';
      } catch {
        return false;
      }
    },
    { message: 'Adresse web invalide (https:// attendu).' },
  );

export const latitudeSchema = z.coerce.number().min(-90).max(90);
export const longitudeSchema = z.coerce.number().min(-180).max(180);

/** Algeria's bounding box, used to reject obviously wrong coordinates. */
export const algeriaLatitude = z.coerce.number().min(18).max(38);
export const algeriaLongitude = z.coerce.number().min(-9).max(12.5);

export const sortDirection = z.enum(['asc', 'desc']).default('desc');

/**
 * Parses a comma-separated query param (`?categories=a,b,c`) or a repeated one
 * (`?categories=a&categories=b`) into a validated array of strings.
 */
export function csvOf(schema: z.ZodType<string, string>) {
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const parts = Array.isArray(value) ? value : value.split(',');
      return parts.map((part) => part.trim()).filter(Boolean);
    })
    .pipe(z.array(schema).max(50).optional());
}
