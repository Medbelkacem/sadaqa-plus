import 'server-only';

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';

import { serverEnv } from '@/config/env';

import type { StorageDriver, StoredObject } from './types';

/**
 * Filesystem driver.
 *
 * Suitable for development and single-node deployments. It cannot issue signed
 * URLs, so private objects are streamed through `/api/files/[id]`, which
 * performs the authorization check on every read.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local' as const;

  private get root() {
    return resolve(process.cwd(), serverEnv().STORAGE_LOCAL_DIR);
  }

  /**
   * Resolves a storage key to an absolute path and refuses anything that
   * escapes the storage root — the classic `../../etc/passwd` traversal.
   */
  private pathFor(key: string) {
    const normalized = normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    const target = resolve(this.root, normalized);
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new Error('Refusing to access a path outside the storage root.');
    }
    return target;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body, { mode: 0o640 });
    return { key, size: body.byteLength, contentType };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async signedUrl(): Promise<string | null> {
    // Intentionally unsupported: there is no public origin for these files.
    return null;
  }

  /** Exposed for the health check in the admin panel. */
  async ensureRoot() {
    await mkdir(join(this.root, 'uploads'), { recursive: true });
  }
}
