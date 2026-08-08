import 'server-only';

import { serverEnv } from '@/config/env';

import { BlobStorageDriver } from './blob-driver';
import { LocalStorageDriver } from './local-driver';
import { S3StorageDriver } from './s3-driver';
import type { StorageDriver } from './types';

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;
  switch (serverEnv().STORAGE_DRIVER) {
    case 's3':
      driver = new S3StorageDriver();
      break;
    case 'blob':
      driver = new BlobStorageDriver();
      break;
    default:
      driver = new LocalStorageDriver();
  }
  return driver;
}

export * from './types';
