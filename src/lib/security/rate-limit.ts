/**
 * Fixed-window rate limiting. The storage is pluggable so the logic can be
 * tested without a database; the app uses the Prisma-backed store.
 */

export interface RateLimitBucket {
  count: number;
  resetAt: Date;
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitBucket | null>;
  /** Start a new window with count = 1. */
  start(key: string, resetAt: Date): Promise<void>;
  /** Atomically add one and return the new count. */
  increment(key: string): Promise<number>;
  clear(key: string): Promise<void>;
}

export interface RateLimitRule {
  /** Maximum attempts allowed inside one window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the window resets (0 when allowed). */
  retryAfterMs: number;
}

export async function consume(
  store: RateLimitStore,
  key: string,
  rule: RateLimitRule,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const bucket = await store.get(key);
  if (!bucket || bucket.resetAt.getTime() <= now.getTime()) {
    await store.start(key, new Date(now.getTime() + rule.windowMs));
    return { allowed: true, retryAfterMs: 0 };
  }
  const count = await store.increment(key);
  if (count <= rule.limit) return { allowed: true, retryAfterMs: 0 };
  return { allowed: false, retryAfterMs: bucket.resetAt.getTime() - now.getTime() };
}

/** In-memory store for tests. */
export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, RateLimitBucket>();
  async get(key: string) {
    return this.buckets.get(key) ?? null;
  }
  async start(key: string, resetAt: Date) {
    this.buckets.set(key, { count: 1, resetAt });
  }
  async increment(key: string) {
    const b = this.buckets.get(key);
    if (!b) throw new Error(`no bucket for ${key}`);
    b.count += 1;
    return b.count;
  }
  async clear(key: string) {
    this.buckets.delete(key);
  }
}

export function formatRetryAfter(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
