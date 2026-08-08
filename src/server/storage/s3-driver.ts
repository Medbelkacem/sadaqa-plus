import 'server-only';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { serverEnv } from '@/config/env';

import type { StorageDriver, StoredObject } from './types';

/**
 * S3-compatible driver (AWS S3, Cloudflare R2, MinIO, Scaleway…).
 *
 * The bucket is expected to be private. Public-facing images are served
 * through short-lived signed URLs rather than by making the bucket readable.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3' as const;
  private client: S3Client;
  private bucket: string;

  constructor() {
    const env = serverEnv();
    if (!env.STORAGE_S3_BUCKET || !env.STORAGE_S3_ACCESS_KEY || !env.STORAGE_S3_SECRET_KEY) {
      throw new Error(
        'STORAGE_DRIVER=s3 requires STORAGE_S3_BUCKET, STORAGE_S3_ACCESS_KEY and STORAGE_S3_SECRET_KEY.',
      );
    }

    this.bucket = env.STORAGE_S3_BUCKET;
    this.client = new S3Client({
      region: env.STORAGE_S3_REGION ?? 'auto',
      endpoint: env.STORAGE_S3_ENDPOINT,
      forcePathStyle: env.STORAGE_S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.STORAGE_S3_ACCESS_KEY,
        secretAccessKey: env.STORAGE_S3_SECRET_KEY,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Force the browser to download rather than render anything the
        // sniffer might disagree with.
        ContentDisposition: contentType === 'application/pdf' ? 'inline' : undefined,
        CacheControl: 'private, max-age=31536000, immutable',
      }),
    );
    return { key, size: body.byteLength, contentType };
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Object not found: ${key}`);
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async signedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }
}
