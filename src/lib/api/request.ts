import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';

import { errors } from './errors';

/** Best available client address behind Vercel / a reverse proxy. */
export function ipOf(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? '0.0.0.0';
}

const MAX_JSON_BYTES = 256 * 1024;

/** Parses and validates a JSON body. Throws a typed AppError on any problem. */
export async function readJson<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw errors.unsupportedMedia('Expected a JSON request body.');
  }

  const raw = await request.text();
  if (raw.length > MAX_JSON_BYTES) throw errors.payloadTooLarge('Request body is too large.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw errors.validation('Malformed JSON body.');
  }

  // `parse` throws ZodError, which the API envelope converts to field errors.
  return schema.parse(parsed);
}

export type SearchParamsShape = Record<string, string | string[] | undefined>;

export function searchParamsToObject(url: URL): SearchParamsShape {
  const out: SearchParamsShape = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    out[key] = values.length > 1 ? values : values[0];
  }
  return out;
}

/** Parses query string against a schema. */
export function readQuery<T>(request: NextRequest, schema: ZodType<T>): T {
  return schema.parse(searchParamsToObject(new URL(request.url)));
}
