const rateBucket = new Map<string, { n: number; reset: number }>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  let b = rateBucket.get(key);
  if (!b || now > b.reset) {
    b = { n: 0, reset: now + windowMs };
    rateBucket.set(key, b);
  }
  b.n += 1;
  if (b.n > limit) {
    return { ok: false, retryAfterSec: Math.ceil((b.reset - now) / 1000) };
  }
  return { ok: true };
}
