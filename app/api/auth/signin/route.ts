import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
});

/** POST /api/auth/signin — signs in with email and password after verification. */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!(await checkRateLimit(`login:${ip}`, 8, 60_000))) {
      throw new ApiError(429, "rate_limited", "Too many login attempts. Try again in a minute.");
    }

    const body = schema.safeParse(await parseJson<unknown>(request));
    if (!body.success) throw new ApiError(400, "invalid_login", "Email or password is invalid.");

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(body.data);
    if (error || !data.session) throw new ApiError(401, "invalid_login", "Email or password is incorrect.");

    if (!data.user?.email_confirmed_at) {
      throw new ApiError(403, "email_not_verified", "Please verify your email address before signing in.");
    }

    return Response.json({ ok: true, session: data.session });
  } catch (error) {
    return jsonError(error);
  }
}
