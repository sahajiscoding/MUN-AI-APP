import { logger } from "@/lib/server/secure-logger";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Convert a thrown error into a safe JSON response, logging unexpected errors server-side. */
export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) },
      { status: error.status }
    );
  }

  // Server logs only: sanitize through the secure logger so a thrown error
  // carrying PII or credential text never lands verbatim in log storage.
  logger.error("Unhandled API error", { error });
  return Response.json(
    { error: "Something went wrong. Please try again.", code: "internal_error" },
    { status: 500 }
  );
}

/** Build a 405 JSON response listing the allowed HTTP methods. */
export function methodNotAllowed(allowed: string[]) {
  return Response.json(
    { error: "Method not allowed.", code: "method_not_allowed" },
    {
      status: 405,
      headers: { Allow: allowed.join(", ") },
    }
  );
}

/** Build a generic 404 JSON response for unknown API routes. */
export function apiNotFound() {
  return Response.json(
    { error: "API route not found.", code: "not_found" },
    { status: 404 }
  );
}

/**
 * Read a request body with a hard byte budget. The stream is cancelled as soon
 * as the budget is exceeded, so an oversized body is never fully buffered.
 * `Content-Length` is only a fast pre-check — it is optional for chunked
 * requests and is never trusted as the sole enforcement.
 */
export async function readRequestText(request: Request, maxBytes = 512_000): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiError(413, "payload_too_large", "Request body is too large.");
  }

  const body = request.body;
  if (!body) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("payload_too_large").catch(() => undefined);
        throw new ApiError(413, "payload_too_large", "Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Already released or cancelled; nothing to do.
    }
  }

  if (chunks.length === 0) return "";
  if (chunks.length === 1) return new TextDecoder().decode(chunks[0]);

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

/** Parse a request body as JSON within a byte budget, rejecting oversized or invalid payloads. */
export async function parseJson<T>(request: Request, maxBytes = 512_000): Promise<T> {
  let raw: string;
  try {
    raw = await readRequestText(request, maxBytes);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
}
