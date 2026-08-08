import type { ApiResult, Paginated } from './response';
import type { ErrorCode, FieldErrors } from './errors';

/**
 * Browser-side API client.
 *
 * Unwraps the `{ success, data }` envelope and turns a failure into a typed
 * `ApiClientError` so callers can branch on `code` and surface `fields` next
 * to the right form input.
 */

export class ApiClientError extends Error {
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly status: number;
  readonly fields?: FieldErrors;

  constructor(
    code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    status: number,
    fields?: FieldErrors,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiClientError('NETWORK_ERROR', 'Connexion impossible. Vérifiez votre réseau.', 0);
  }

  if (response.status === 204) return undefined as T;

  let payload: ApiResult<T>;
  try {
    payload = (await response.json()) as ApiResult<T>;
  } catch {
    throw new ApiClientError(
      'INTERNAL_ERROR',
      'Une erreur est survenue. Veuillez réessayer.',
      response.status,
    );
  }

  if (!payload.success) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.error.fields,
    );
  }

  return payload.data;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),

  /** Multipart upload; the browser sets its own Content-Type boundary. */
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const response = await fetch(path, {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
    }).catch(() => {
      throw new ApiClientError('NETWORK_ERROR', 'Connexion impossible.', 0);
    });

    const payload = (await response.json()) as ApiResult<T>;
    if (!payload.success) {
      throw new ApiClientError(
        payload.error.code,
        payload.error.message,
        response.status,
        payload.error.fields,
      );
    }
    return payload.data;
  },
};

export type { Paginated };

/** Builds a query string, omitting empty values so URLs stay clean. */
export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}
