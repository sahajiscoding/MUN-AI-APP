import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const schema = z.object({ password: z.string().min(8).max(128) });

/** POST /api/auth/reset-password — updates the password from a recovery token. */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!(await checkRateLimit(`password-update:${ip}`, 5, 10 * 60_000, { failClosed: true }))) {
      throw new ApiError(429, "rate_limited", "Too many password update attempts. Try again later.");
    }

    const authorization = request.headers.get("authorization");
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!token) throw new ApiError(401, "invalid_token", "Your recovery session is invalid or expired.");

    const body = schema.safeParse(await parseJson<unknown>(request));
    if (!body.success) throw new ApiError(400, "invalid_password", "Choose a password of at least 8 characters.");

    const admin = supabaseAdmin();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) throw new ApiError(401, "invalid_token", "Your recovery session is invalid or expired.");

    const { error } = await admin.auth.admin.updateUserById(userData.user.id, { password: body.data.password });
    if (error) throw new ApiError(400, "password_update_failed", "This reset link may have expired. Request a new one and try again.");

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
