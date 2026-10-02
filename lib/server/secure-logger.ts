/**
 * SERVER-ONLY MODULE — never import from client components.
 * Enforced by the client-bundle boundary check (SECURITY.md §4.2):
 * `lib/server/*` must not appear under `components/`.
 *
 * Server-only structured logger with secret and PII redaction.
 *
 * Goals (SEC-LOG-01, SEC-ENV-04):
 * - NEVER log credential values, tokens, raw webhook bodies, signatures,
 *   or full PII (emails, UIDs, order refs) to server logs.
 * - Keep enough correlation signal (truncated ID prefixes) for debugging.
 * - Cap message/field sizes so a single log line cannot blow up log storage.
 *
 * Usage:
 *   import { logger } from "@/lib/server/secure-logger";
 *   logger.error("Payment lookup failed", { paymentId: "..." });
 *
 * All dynamic fields pass through `sanitize()` before reaching console.
 */

const MAX_STRING_LENGTH = 500;
const ID_PREFIX_LENGTH = 8;

const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /Bearer\s+[A-Za-z0-9._-]+/gi, replacement: "Bearer [redacted]" },
  { pattern: /nvapi-[A-Za-z0-9_-]+/gi, replacement: "[redacted-nvapi-key]" },
  { pattern: /sk-live-[A-Za-z0-9_-]+/gi, replacement: "[redacted-secret]" },
  { pattern: /xox[bap]-[A-Za-z0-9-]+/gi, replacement: "[redacted-token]" },
  { pattern: /ghp_[A-Za-z0-9]+/g, replacement: "[redacted-token]" },
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: "[redacted-aws-key]" },
  { pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, replacement: "[redacted-credential]" },
  {
    pattern: /([?&](?:apikey|api_key|token|access_token|secret|key|auth)=)[^\s&"'<>]+/gi,
    replacement: "$1[redacted]",
  },
  {
    pattern: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
    replacement: "[redacted-private-key]",
  },
];

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function truncate(value: string, max = MAX_STRING_LENGTH): string {
  return value.length > max ? `${value.slice(0, max)}…[truncated]` : value;
}

/** Keep only a short prefix of an opaque identifier for log correlation. */
export function truncatedId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "[missing-id]";
  const clean = value.trim();
  if (clean.length <= ID_PREFIX_LENGTH) return "[redacted-id]";
  return `${clean.slice(0, ID_PREFIX_LENGTH)}…`;
}

/** Mask an email address while keeping the domain for triage. */
export function maskEmail(value: unknown): string {
  if (typeof value !== "string") return "[redacted-email]";
  const at = value.indexOf("@");
  if (at <= 0) return "[redacted-email]";
  const domain = value.slice(at + 1);
  return `…@${truncate(domain, 60)}`;
}

function redactSecretsText(text: string): string {
  let out = text;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(EMAIL_PATTERN, (match) => maskEmail(match));
  return out;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth-limit]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncate(redactSecretsText(value));
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    // Log the message only — never stack traces with file paths in production.
    return truncate(redactSecretsText(value.message || "unknown error"));
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record).slice(0, 20)) {
      const lowered = key.toLowerCase();
      if (
        lowered.includes("secret") ||
        lowered.includes("password") ||
        lowered.includes("token") ||
        lowered.includes("apikey") ||
        lowered.includes("api_key") ||
        lowered.includes("authorization") ||
        lowered.includes("signature") ||
        lowered.includes("nonce") ||
        lowered === "rawbody" ||
        lowered === "raw_body"
      ) {
        out[key] = "[redacted]";
        continue;
      }
      if (lowered === "email" || lowered.endsWith("_email") || lowered === "customer_email") {
        out[key] = maskEmail(entry);
        continue;
      }
      if (
        lowered === "uid" ||
        lowered === "userid" ||
        lowered === "user_id" ||
        lowered === "orderid" ||
        lowered === "order_id" ||
        lowered === "orderref" ||
        lowered === "order_ref" ||
        lowered === "paymentid" ||
        lowered === "payment_id" ||
        lowered === "eventid" ||
        lowered === "event_id"
      ) {
        out[key] = truncatedId(entry);
        continue;
      }
      out[key] = sanitizeValue(entry, depth + 1);
    }
    return out;
  }
  return "[unloggable]";
}

function emit(
  level: "error" | "warn" | "info" | "debug",
  message: string,
  fields?: unknown,
) {
  const safeMessage = truncate(redactSecretsText(message));
  if (fields === undefined) {
    console[level](safeMessage);
    return;
  }
  console[level](safeMessage, sanitizeValue(fields));
}

export const logger = {
  error(message: string, fields?: unknown) {
    emit("error", message, fields);
  },
  warn(message: string, fields?: unknown) {
    emit("warn", message, fields);
  },
  info(message: string, fields?: unknown) {
    emit("info", message, fields);
  },
  debug(message: string, fields?: unknown) {
    if (process.env.NODE_ENV !== "production") {
      emit("debug", message, fields);
    }
  },
};

export function redactProviderMessage(message: string): string {
  return truncate(redactSecretsText(message), 1000);
}
