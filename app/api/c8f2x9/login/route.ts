import { ApiError, jsonError, parseJson } from "@/lib/api";
import { adminLogin, setAdminSession, clearAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 2_048) {
      throw new ApiError(413, "request_too_large", "The request is too large.");
    }

    // Prefer platform-controlled client headers; do not trust a user-supplied
    // list in x-forwarded-for as the primary identity.
    const ip = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(`admin-login:${ip}`, 5, 60_000)) {
      throw new ApiError(429, "rate_limited", "Too many login attempts. Try again in a minute.");
    }

    const body = await parseJson<{ password?: unknown }>(request);
    if (typeof body.password !== "string" || body.password.length > 256) {
      throw new ApiError(400, "invalid_request", "A valid password is required.");
    }
    const session = await adminLogin(body.password);
    await setAdminSession(session);

    return Response.json({ ok: true, admin: { email: session.email } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE() {
  await clearAdminSession();
  return Response.json({ ok: true });
}
