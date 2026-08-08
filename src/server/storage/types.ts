/**
 * Storage boundary.
 *
 * Two implementations ship: a local filesystem driver for development and
 * single-node deployments, and an S3-compatible driver for anything that
 * scales horizontally. Application code only ever sees this interface, so
 * switching is a configuration change rather than a rewrite.
 */

export type StoredObject = {
  key: string;
  size: number;
  contentType: string;
};

export interface StorageDriver {
  readonly name: 'local' | 's3';

  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;

  get(key: string): Promise<Buffer>;

  delete(key: string): Promise<void>;

  /**
   * A time-limited URL for a private object, or `null` when the driver cannot
   * issue one (the local driver). Callers fall back to streaming the file
   * through the authorized route in that case.
   */
  signedUrl(key: string, expiresInSeconds: number): Promise<string | null>;
}

/** Only these types are ever accepted, matched on sniffed bytes as well as MIME. */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const EXTENSION_BY_MIME: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
