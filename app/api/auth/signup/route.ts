import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
  website: z.string().max(0).optional(),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!(await checkRateLimit(`signup:${ip}`, 5, 10 * 60_000))) {
      throw new ApiError(429, "rate_limited", "Too many signup attempts. Please try again later.");
    }

    const body = signupSchema.safeParse(await parseJson<unknown>(request));
    if (!body.success) {
      throw new ApiError(400, "invalid_signup", "Please provide a valid name, email, and password.");
    }

    // Honeypot: normal browsers submit an empty field; simple signup bots
    // commonly fill every visible-looking input.
    if (body.data.website) {
      return Response.json({ ok: true, sessionCreated: false });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: body.data.email,
      password: body.data.password,
      options: {
        data: { full_name: body.data.name },
        emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
      },
    });

    if (error) throw new ApiError(400, "signup_failed", error.message);

    return Response.json({
      ok: true,
      sessionCreated: Boolean(data.session),
    });
  } catch (error) {
    return jsonError(error);
  }
}
