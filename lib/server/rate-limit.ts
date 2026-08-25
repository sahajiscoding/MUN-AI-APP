const attempts = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit. Returns true if allowed, false if blocked.
 * @param key - unique identifier (e.g. IP + endpoint)
 * @param maxAttempts - max attempts before blocking
 * @param windowMs - time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60_000
): boolean {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now > record.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  record.count++;

  if (record.count > maxAttempts) {
    return false;
  }

  return true;
}

/**
 * Get remaining attempts before rate limit hits
 */
export function getRemainingAttempts(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60_000
): number {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now > record.resetAt) {
    return maxAttempts;
  }

  return Math.max(0, maxAttempts - record.count);
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts) {
    if (now > record.resetAt) {
      attempts.delete(key);
    }
  }
}, 5 * 60 * 1000);
