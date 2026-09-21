import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().trim().email().max(320) });

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!(await checkRateLimit(`password-reset:${ip}`, 5, 10 * 60_000))) {
      throw new ApiError(429, "rate_limited", "Too many password reset requests. Try again later.");
    }

    const body = schema.safeParse(await parseJson<unknown>(request));
    if (!body.success) throw new ApiError(400, "invalid_email", "Please enter a valid email address.");

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(body.data.email, {
      redirectTo: `${new URL(request.url).origin}/auth/reset-password`,
    });

    if (error) throw new ApiError(400, "reset_request_failed", "We could not start password recovery.");
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
