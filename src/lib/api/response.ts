import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { AppError, ERROR_CODES, errors, type ErrorCode, type FieldErrors } from './errors';

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiFailure = {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    fields?: FieldErrors;
  };
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export function ok<T>(data: T, meta?: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data, ...(meta ? { meta } : {}) }, init);
}

export function created<T>(data: T, meta?: Record<string, unknown>) {
  return ok(data, meta, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function fail(error: AppError) {
  const body: ApiFailure = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    },
  };

  const headers = new Headers();
  if (error.code === ERROR_CODES.RATE_LIMITED) {
    const retry = (error.meta?.retryAfterSeconds as number | undefined) ?? 60;
    headers.set('Retry-After', String(retry));
  }

  return NextResponse.json(body, { status: error.status, headers });
}

function zodToFieldErrors(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    (fields[path] ??= []).push(issue.message);
  }
  return fields;
}

/**
 * Converts anything thrown inside a route handler into a safe API failure.
 *
 * Unknown errors are logged server-side with their real detail and returned to
 * the caller as a generic INTERNAL_ERROR — no stack trace, no SQL, no Prisma
 * error text ever reaches the client.
 */
export function toApiFailure(error: unknown) {
  if (error instanceof AppError) return fail(error);

  if (error instanceof ZodError) {
    return fail(errors.validation('The submitted data is invalid.', zodToFieldErrors(error)));
  }

  // Prisma unique-constraint violations are the one DB error worth surfacing,
  // and only as a generic conflict without naming the constraint.
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  ) {
    return fail(errors.conflict('This item already exists.'));
  }

  console.error('[api] unhandled error', error);
  return fail(errors.internal());
}

/** Wraps a route handler so no unexpected throw escapes as an HTML error page. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return toApiFailure(error);
    }
  };
}

export function paginate<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}
