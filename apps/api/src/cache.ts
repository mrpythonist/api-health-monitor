import Redis from 'ioredis';

/**
 * Optional Redis cache for the public status pages.
 *
 * If REDIS_URL is unset or unreachable, the API logs a warning once and serves
 * everything straight from PostgreSQL. Cached aggregates carry a 30s TTL and
 * are invalidated when a monitor's configuration changes.
 */

let client: Redis | null = null;

export async function initCache(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[cache] REDIS_URL not set — status pages will run uncached');
    return;
  }
  try {
    const r = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      // Fail fast: reconnects during request-time calls would just hide outages.
      retryStrategy: () => null,
    });
    r.on('error', (err: Error) => console.warn('[cache] redis error:', err.message));
    await r.ping();
    client = r;
    console.log('[cache] Redis connected — status page caching enabled');
  } catch (err) {
    console.warn('[cache] Redis unreachable — running without cache:', (err as Error).message);
    client = null;
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  if (!client) return null;
  try {
    return await client.get(key);
  } catch (err) {
    console.warn('[cache] get failed:', (err as Error).message);
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds = 30): Promise<void> {
  if (!client) return;
  try {
    await client.set(key, value, 'EX', ttlSeconds);
  } catch (err) {
    console.warn('[cache] set failed:', (err as Error).message);
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!client) return;
  try {
    await client.del(key);
  } catch (err) {
    console.warn('[cache] del failed:', (err as Error).message);
  }
}
