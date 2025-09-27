import { Redis } from "@upstash/redis";

export type KV = {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
};

class InMemoryKV implements KV {
  private map = new Map<string, { v: unknown; exp?: number }>();
  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.exp && entry.exp < now) {
      this.map.delete(key);
      return null;
    }
    return entry.v as T;
  }
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const exp = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.map.set(key, { v: value, exp });
  }
  async del(key: string): Promise<void> {
    this.map.delete(key);
  }
}

let client: KV | null = null;

export function getKV(): KV {
  if (client) return client;
  const url = process.env.REDIS_URL;
  const token = process.env.REDIS_TOKEN;
  if (url && token) {
    const redis = new Redis({ url, token });
    client = {
      async get<T>(key: string) {
        return (await redis.get(key)) as T | null;
      },
      async set<T>(key: string, value: T, ttlSeconds?: number) {
        if (ttlSeconds) await redis.set(key, value as any, { ex: ttlSeconds });
        else await redis.set(key, value as any);
      },
      async del(key: string) {
        await redis.del(key);
      },
    } satisfies KV;
  } else {
    client = new InMemoryKV();
  }
  return client;
}

export async function withLock(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<void>,
): Promise<boolean> {
  // Simple lock for Upstash only; no-op for in-memory
  const url = process.env.REDIS_URL;
  const token = process.env.REDIS_TOKEN;
  if (!(url && token)) {
    await fn();
    return true;
  }
  const redis = new Redis({ url, token });
  const tokenVal = Math.random().toString(36).slice(2);
  const ok = await redis.set(key, tokenVal, { nx: true, ex: ttlSeconds });
  if (!ok) return false;
  try {
    await fn();
  } finally {
    const cur = await redis.get<string>(key);
    if (cur === tokenVal) await redis.del(key);
  }
  return true;
}
