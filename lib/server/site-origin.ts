/**
 * Resolve the canonical site origin for out-of-band links (signup verification,
 * password reset). `request.url` reflects the Host header, which can be
 * influenced by proxy misconfiguration; the configured site URL is the only
 * origin we control. Falls back to the request origin for local development.
 */
export function resolveSiteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      // Ignore malformed configuration and fall back below.
    }
  }

  return new URL(request.url).origin;
}
