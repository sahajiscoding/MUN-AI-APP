/**
 * CSRF Protection Utilities
 *
 * Enforces strict Origin checking on state-changing HTTP requests (POST, PUT, PATCH, DELETE)
 * to prevent Cross-Site Request Forgery (CSRF).
 *
 * For browser-session writes:
 * - Origin header MUST be present.
 * - Origin header MUST match the application origin or the configured canonical site URL.
 * - Absent, malformed, opaque ("null"), or foreign origins are strictly rejected with 403.
 *
 * Machine-to-machine routes:
 * - Machine-to-machine endpoints (e.g. payment webhooks under /api/webhooks/*) are
 *   explicitly exempted from the browser origin check because they are invoked
 *   server-to-server and authenticate independently via cryptographic signatures
 *   (e.g. HMAC-SHA256 signature verification).
 */

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Check whether an HTTP method can modify state and requires CSRF origin verification.
 */
export function isStateChanging(method: string): boolean {
  return STATE_CHANGING_METHODS.has(method.toUpperCase());
}

/**
 * Check whether a route is an exempt machine-to-machine endpoint.
 *
 * Machine routes (such as payment webhooks) do not use browser cookies or user sessions;
 * they authenticate independently via request signatures (HMAC) and typically omit or
 * provide third-party Origin headers.
 */
export function isExemptMachineRoute(pathname: string): boolean {
  return pathname.startsWith("/api/webhooks/");
}

interface RequestWithOrigin {
  headers: Headers;
  url?: string;
  nextUrl?: {
    origin: string;
    pathname: string;
  };
}

/**
 * Verify that a request Origin matches the expected app origin.
 *
 * Returns false if:
 * - Origin header is absent (protects cookie-authenticated write routes from origin-less cross-site requests).
 * - Origin header is malformed or invalid URL.
 * - Origin header is "null" (opaque origin / sandboxed iframes).
 * - Origin does not match the request origin or configured site URL.
 */
export function isSafeOrigin(request: RequestWithOrigin): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  const trimmed = origin.trim();
  if (!trimmed || trimmed === "null") {
    return false;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(trimmed);
  } catch {
    return false;
  }

  // Reject opaque or non-http(s) origins
  if (originUrl.origin === "null" || (originUrl.protocol !== "https:" && originUrl.protocol !== "http:")) {
    return false;
  }

  const candidateOrigin = originUrl.origin;

  // 1. Check against request's own origin
  const requestOrigin = request.nextUrl?.origin ?? (request.url ? new URL(request.url).origin : null);
  if (requestOrigin && candidateOrigin === requestOrigin) {
    return true;
  }

  // 2. Check against configured canonical site origin (for reverse-proxy / CDN setups)
  const configuredSite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSite) {
    try {
      const siteUrl = new URL(configuredSite);
      if (candidateOrigin === siteUrl.origin) {
        return true;
      }
    } catch {
      // Ignore malformed environment variable
    }
  }

  return false;
}
