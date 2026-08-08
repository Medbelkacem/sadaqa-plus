import 'server-only';

import { del, get, put } from '@vercel/blob';

import type { StorageDriver, StoredObject } from './types';

/**
 * Vercel Blob driver.
 *
 * Objects are written with `access: 'private'`, so a leaked URL is not enough
 * to read a beneficiary's document.
 *
 * This is the driver to use on any serverless platform: the filesystem there is
 * ephemeral, so `STORAGE_DRIVER=local` would silently lose uploads between
 * invocations.
 */
export class BlobStorageDriver implements StorageDriver {
  readonly name = 'blob' as const;

  constructor() {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error(
        'STORAGE_DRIVER=blob requires BLOB_READ_WRITE_TOKEN. Create a store with `vercel blob create-store <name> --access private`.',
      );
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await put(key, body, {
      access: 'private',
      contentType,
      // The key is already a UUID path; a random suffix would break lookups.
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31_536_000,
    });

    return { key, size: body.byteLength, contentType };
  }

  async get(key: string): Promise<Buffer> {
    const result = await get(key, { access: 'private' });
    if (!result?.stream) throw new Error(`Object not found: ${key}`);

    // Uploads are capped at 8 MiB, so buffering the stream is bounded.
    const chunks: Uint8Array[] = [];
    const reader = result.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await del(key);
  }

  /**
   * Deliberately returns null.
   *
   * A presigned URL would let the file be fetched again, later, by anyone
   * holding the link, for as long as it is valid. Streaming every read through
   * `/api/files/[id]` instead means the permission check runs on *every*
   * request — which is the right trade for documents about vulnerable people,
   * at 8 MiB per object.
   */
  async signedUrl(): Promise<string | null> {
    return null;
  }
}
