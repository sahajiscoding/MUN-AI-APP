import { ApiError, jsonError, parseJson } from "@/lib/api";
import { adminLogin, setAdminSession, clearAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // Rate limit: 5 attempts per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`admin-login:${ip}`, 5, 60_000)) {
      throw new ApiError(429, "rate_limited", "Too many login attempts. Try again in a minute.");
    }

    const body = await parseJson<{ password: string }>(request);
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
