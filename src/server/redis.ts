import 'server-only';

import Redis from 'ioredis';

import { serverEnv } from '@/config/env';

const globalForRedis = globalThis as unknown as {
  sadaqaRedis?: Redis | null;
};

/**
 * Shared Redis connection, or `null` when REDIS_URL is not configured.
 *
 * Callers must handle the null case explicitly — nothing in the platform
 * silently degrades without saying so.
 */
export function redis(): Redis | null {
  if (globalForRedis.sadaqaRedis !== undefined) return globalForRedis.sadaqaRedis;

  const url = serverEnv().REDIS_URL;
  if (!url) {
    globalForRedis.sadaqaRedis = null;
    return null;
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 200, 3000),
  });

  client.on('error', (error) => {
    // Redis is a availability dependency for rate limiting, not a correctness
    // one; log and let callers fall back rather than failing the request.
    console.error('[redis] connection error:', error.message);
  });

  globalForRedis.sadaqaRedis = client;
  return client;
}

export function redisAvailable() {
  return Boolean(serverEnv().REDIS_URL);
}
