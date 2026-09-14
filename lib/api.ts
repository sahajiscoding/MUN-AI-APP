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

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) },
      { status: error.status }
    );
  }

  console.error(error);
  return Response.json(
    { error: "Something went wrong. Please try again.", code: "internal_error" },
    { status: 500 }
  );
}

export async function parseJson<T>(request: Request, maxBytes = 512_000): Promise<T> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
  // Defense-in-depth body cap: field-level zod max()s run after parsing, so
  // bound raw bytes first. The platform also caps request size; this keeps a
  // single oversized JSON body from consuming disproportionate memory/CPU
  // before validation runs.
  if (raw.length > maxBytes) {
    throw new ApiError(413, "payload_too_large", "Request body is too large.");
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
}
