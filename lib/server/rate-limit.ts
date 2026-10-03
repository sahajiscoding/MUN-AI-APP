import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/server/secure-logger";

// DB-backed rate limiting. In-memory state is only a fallback so the app can
// still function when the database is unreachable (e.g. local development);
// production must rely on the shared Supabase table, which survives Vercel
// serverless instance churn.
//
// The fallback is process-local, so during a ledger outage limits become
// approximate (per instance, reset on cold start). That is deliberate — auth
// already requires Supabase, so a database outage fails closed on protected
// routes — but it is logged at error level in production so an extended
// outage is visible instead of silently weakening enforcement (SEC-RL-03).
const attempts = new Map<string, { count: number; resetAt: number }>();

/** Log use of the in-memory rate-limit fallback, as an error in production. */
function logFallback(message: string, detail: string) {
  const line = `${message}: ${detail}`;
  if (process.env.NODE_ENV === "production") {
    logger.error(line);
  } else {
    logger.warn(line);
  }
}

/** Enforce a process-local sliding-window rate limit as a DB fallback. */
function memoryCheck(key: string, maxAttempts: number, windowMs: number): boolean {
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
 * Check rate limit against the shared store. Returns true if allowed,
 * false if blocked.
 *
 * @param key - unique identifier (e.g. IP + endpoint)
 * @param maxAttempts - max attempts before blocking
 * @param windowMs - time window in milliseconds
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60_000
): Promise<boolean> {
  if (maxAttempts <= 0 || windowMs <= 0) return false;

  try {
    const { data, error } = await supabaseAdmin().rpc("rate_limit_check", {
      p_key: key,
      p_max: maxAttempts,
      p_window_ms: windowMs,
    });

    if (error) {
      logFallback("DB rate limit check failed, falling back to memory", error.message);
      return memoryCheck(key, maxAttempts, windowMs);
    }

    return data === true;
  } catch (error) {
    logFallback(
      "DB rate limit unavailable, falling back to memory",
      error instanceof Error ? error.message : "unknown error"
    );
    return memoryCheck(key, maxAttempts, windowMs);
  }
}

/**
 * Best-effort view of remaining attempts (memory fallback only). Used for
 * informative counters, never as the enforcement decision.
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

/**
 * Resolve the real client IP from platform-controlled headers.
 *
 * Vercel and similar platforms append the true peer address to
 * x-forwarded-for, so the client-supplied head of the list must NOT be
 * trusted. Prefer x-vercel-forwarded-for / x-real-ip and otherwise take the
 * LAST x-forwarded-for entry.
 */
export function getClientIp(request: Request): string {
  const platform = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-real-ip");
  if (platform) return platform;

  const forwarded = request.headers.get("x-forwarded-for")?.trim();
  if (forwarded) {
    const entries = forwarded.split(",").map((entry) => entry.trim()).filter(Boolean);
    const tail = entries[entries.length - 1];
    if (tail) return tail;
  }

  return "unknown";
}

// Cleanup old memory-fallback entries every 5 minutes.
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts) {
    if (now > record.resetAt) {
      attempts.delete(key);
    }
  }
}, 5 * 60 * 1000);
