/**
 * Application error taxonomy.
 *
 * Every error that reaches an API boundary is converted into one of these
 * codes. Stack traces, SQL text and Prisma internals never cross the boundary.
 */

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  SERVICE_NOT_CONFIGURED: 'SERVICE_NOT_CONFIGURED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INVALID_STATE_TRANSITION: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  SERVICE_NOT_CONFIGURED: 503,
  INTERNAL_ERROR: 500,
};

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: FieldErrors;
  readonly meta?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { status?: number; fields?: FieldErrors; meta?: Record<string, unknown> },
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = options?.status ?? DEFAULT_STATUS[code];
    this.fields = options?.fields;
    this.meta = options?.meta;
  }
}

export const errors = {
  validation: (message = 'The submitted data is invalid.', fields?: FieldErrors) =>
    new AppError(ERROR_CODES.VALIDATION_ERROR, message, { fields }),

  unauthenticated: (message = 'Authentication is required.') =>
    new AppError(ERROR_CODES.UNAUTHENTICATED, message),

  forbidden: (message = 'You are not allowed to perform this action.') =>
    new AppError(ERROR_CODES.FORBIDDEN, message),

  /**
   * Used for resources the caller may not access. Deliberately identical to a
   * genuine 404 so an attacker cannot probe for the existence of records they
   * do not own.
   */
  notFound: (message = 'The requested resource was not found.') =>
    new AppError(ERROR_CODES.NOT_FOUND, message),

  conflict: (message: string) => new AppError(ERROR_CODES.CONFLICT, message),

  rateLimited: (retryAfterSeconds: number) =>
    new AppError(ERROR_CODES.RATE_LIMITED, 'Too many attempts. Please try again later.', {
      meta: { retryAfterSeconds },
    }),

  invalidTransition: (from: string, to: string) =>
    new AppError(
      ERROR_CODES.INVALID_STATE_TRANSITION,
      `This item cannot move from ${from} to ${to}.`,
      { meta: { from, to } },
    ),

  unsupportedMedia: (message = 'This file type is not accepted.') =>
    new AppError(ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, message),

  payloadTooLarge: (message = 'This file is too large.') =>
    new AppError(ERROR_CODES.PAYLOAD_TOO_LARGE, message),

  notConfigured: (service: string) =>
    new AppError(
      ERROR_CODES.SERVICE_NOT_CONFIGURED,
      `${service} is not configured on this deployment.`,
      { meta: { service } },
    ),

  internal: (message = 'An unexpected error occurred.') =>
    new AppError(ERROR_CODES.INTERNAL_ERROR, message),
};
