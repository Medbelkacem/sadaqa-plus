import 'server-only';

import { serverEnv } from '@/config/env';

import { LocalStorageDriver } from './local-driver';
import { S3StorageDriver } from './s3-driver';
import type { StorageDriver } from './types';

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;
  driver = serverEnv().STORAGE_DRIVER === 's3' ? new S3StorageDriver() : new LocalStorageDriver();
  return driver;
}

export * from './types';
