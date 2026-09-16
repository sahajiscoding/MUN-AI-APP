export async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();

  if (!contentType.includes("application/json")) {
    throw new Error(
      `Expected a JSON response but received ${contentType || "an unknown content type"}.`
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Server returned malformed JSON.");
  }
}
