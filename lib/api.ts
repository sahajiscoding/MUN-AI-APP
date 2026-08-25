export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error(error);
  return Response.json(
    { error: "Something went wrong. Please try again.", code: "internal_error" },
    { status: 500 }
  );
}

export async function parseJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
}
