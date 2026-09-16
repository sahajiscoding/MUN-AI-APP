export async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();

  // Parse as JSON when the server labels it JSON, or when the body looks
  // like JSON even if an edge proxy / WAF stripped the content type.
  // ZAP active scans can trigger Vercel firewall or rate-limit pages
  // (often `text/plain`) for background fetches; those fall through to the
  // friendly status-mapped error below instead of leaking content types.
  if (contentType.includes("application/json") || /^[\s]*[{[]/.test(text)) {
    try {
      return JSON.parse(text) as T;
    } catch {
      // Fall through to the friendly error below.
    }
  }

  console.error(
    `Non-JSON response: status ${response.status} content-type ${contentType || "unknown"}.`
  );
  throw new Error(friendlyHttpError(response.status));
}

function friendlyHttpError(status: number): string {
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status === 401 || status === 403) return "Your session could not be verified. Please sign in again.";
  if (status === 404) return "The requested data could not be found.";
  if (status >= 500) return "The server is temporarily unavailable. Please try again.";
  return "Server returned an unexpected response. Please try again.";
}
