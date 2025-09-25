export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number; // epoch milliseconds when bucket resets
}

export interface RateLimiterOptions {
  kv: KVNamespace;
  limit: number;
  windowSeconds: number;
  now?: number;
}

const COUNTER_PREFIX = "rate:";

export async function enforceRateLimit(
  key: string,
  options: RateLimiterOptions
): Promise<RateLimitResult> {
  const now = options.now ?? Date.now();
  const windowMs = options.windowSeconds * 1000;
  const bucketStart = Math.floor(now / windowMs) * windowMs;
  const bucketKey = `${COUNTER_PREFIX}${key}:${bucketStart}`;
  const ttl = Math.max(1, options.windowSeconds);

  const existingRaw = await options.kv.get(bucketKey);
  let count = 0;

  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw) as { count: number };
      count = parsed.count ?? 0;
    } catch (error) {
      console.warn("rateLimiter: failed to parse counter", { bucketKey, error });
      count = 0;
    }
  }

  if (count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      reset: bucketStart + windowMs,
    };
  }

  const nextCount = count + 1;
  await options.kv.put(bucketKey, JSON.stringify({ count: nextCount }), {
    expirationTtl: ttl,
  });

  return {
    allowed: true,
    remaining: Math.max(options.limit - nextCount, 0),
    reset: bucketStart + windowMs,
  };
}
