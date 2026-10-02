/**
 * Client-safe error text sanitizer.
 *
 * Server error strings are meant to be generic, but third-party SDKs and
 * network layers sometimes embed request URLs, `apikey` query params, JWTs,
 * or raw tokens in their messages. Anything rendered in the UI must pass
 * through here first so a confusing backend error can never leak a secret
 * onto the screen (SEC-ERR-01).
 *
 * Usage:
 *   setStatus(sanitizePublicMessage(caught, "Something went wrong."));
 */

const MAX_PUBLIC_MESSAGE_LENGTH = 300;

const REDACTIONS: Array<{ pattern: RegExp; replacement: string }> = [
  // Full JWTs (e.g. Supabase anon/service keys in URLs).
  {
    pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    replacement: "[redacted-credential]",
  },
  // Secret-looking query params (?apikey=, &token=, ...). Keeps the key name.
  {
    pattern: /([?&](?:apikey|api_key|token|access_token|secret|key|auth)=)[^\s&"'<>]+/gi,
    replacement: "$1[redacted]",
  },
  // Any remaining absolute URL (may carry credentials or internal hosts).
  { pattern: /https?:\/\/[^\s"'<>]+/gi, replacement: "[link removed]" },
  // PEM private keys.
  {
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
    replacement: "[redacted-private-key]",
  },
  // Long dash-free base64-ish blobs (raw tokens). Dash-containing IDs such
  // as UUID order references are deliberately spared.
  { pattern: /\b[A-Za-z0-9_]{40,}\b/g, replacement: "[redacted-token]" },
];

function applyRedactions(text: string): string {
  let out = text;
  for (const { pattern, replacement } of REDACTIONS) {
    // Reset lastIndex for global regexes reused across calls.
    pattern.lastIndex = 0;
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Return a UI-safe string for `value`, or `fallback` when there is nothing
 * safe to show. Never throws.
 */
export function sanitizePublicMessage(value: unknown, fallback: string): string {
  try {
    if (typeof value !== "string") return fallback;
    const cleaned = applyRedactions(value).replace(/\s+/g, " ").trim();
    if (!cleaned) return fallback;
    return cleaned.length > MAX_PUBLIC_MESSAGE_LENGTH
      ? `${cleaned.slice(0, MAX_PUBLIC_MESSAGE_LENGTH)}…`
      : cleaned;
  } catch {
    return fallback;
  }
}
