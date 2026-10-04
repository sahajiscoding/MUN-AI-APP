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

export interface RateLimitOptions {
  /**
   * If true, failures communicating with the rate limit database store (e.g. Supabase error
   * or network failure) will fail closed (return false) instead of falling back to
   * process-local memory.
   *
   * Crucial for costly AI operations, login/auth brute-force mitigation, and payment actions.
   */
  failClosed?: boolean;
}

/**
 * Check rate limit against the shared store. Returns true if allowed,
 * false if blocked.
 *
 * @param key - unique identifier (e.g. IP + endpoint)
 * @param maxAttempts - max attempts before blocking
 * @param windowMs - time window in milliseconds
 * @param options - optional configuration (e.g. failClosed)
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60_000,
  options?: RateLimitOptions
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
      if (options?.failClosed) {
        return false;
      }
      return memoryCheck(key, maxAttempts, windowMs);
    }

    return data === true;
  } catch (error) {
    logFallback(
      "DB rate limit unavailable, falling back to memory",
      error instanceof Error ? error.message : "unknown error"
    );
    if (options?.failClosed) {
      return false;
    }
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

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/**
 * Validate and sanitize an IP address string, stripping any port number.
 */
export function sanitizeIp(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;

  // IPv4 with port: 192.0.2.1:8080 -> 192.0.2.1
  const ipv4WithPort = trimmed.match(/^((?:[0-9]{1,3}\.){3}[0-9]{1,3}):\d+$/);
  const ip = ipv4WithPort ? ipv4WithPort[1] : trimmed;
  if (IPV4_REGEX.test(ip)) {
    return ip;
  }

  // Bracketed IPv6 with optional port: [2001:db8::1]:8080 -> 2001:db8::1
  const bracketedIpv6 = trimmed.match(/^\[([0-9a-fA-F:]+)\](?::\d+)?$/);
  if (bracketedIpv6) {
    return bracketedIpv6[1];
  }

  // Standard IPv6 (contains colons, hex characters)
  if (/^[0-9a-fA-F:]+$/.test(trimmed) && trimmed.includes(":")) {
    return trimmed;
  }

  return null;
}

/**
 * Resolve the real client IP from platform-controlled headers.
 *
 * In production on Vercel or behind a trusted reverse proxy:
 * - `x-vercel-forwarded-for` is injected/managed by Vercel edge and cannot be
 *   forged if the platform is configured properly.
 * - `x-real-ip` is injected by upstream reverse proxies (e.g. Nginx/Cloudflare).
 * - For `x-forwarded-for`, proxies append the client IP to the tail of the list:
 *   e.g. "spoofed-client-ip, proxy-ip". Therefore, taking the LAST valid entry protects
 *   against client-supplied head spoofing.
 *
 * NOTE FOR PRODUCTION INGRESS: Ensure at your ingress proxy/CDN that client-supplied
 * `x-vercel-forwarded-for` and `x-real-ip` headers are stripped from incoming requests
 * if not running directly on Vercel.
 */
export function getClientIp(request: Request): string {
  const platform = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-real-ip");
  if (platform) {
    const sanitized = sanitizeIp(platform);
    if (sanitized) return sanitized;
  }

  const forwarded = request.headers.get("x-forwarded-for")?.trim();
  if (forwarded) {
    const entries = forwarded.split(",").map((entry) => entry.trim()).filter(Boolean);
    for (let i = entries.length - 1; i >= 0; i--) {
      const sanitized = sanitizeIp(entries[i]);
      if (sanitized) return sanitized;
    }
  }

  return "unknown";
}

// Cleanup old memory-fallback entries every 5 minutes.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts) {
    if (now > record.resetAt) {
      attempts.delete(key);
    }
  }
}, 5 * 60 * 1000);
cleanupTimer.unref?.();
