import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { sanitizePublicMessage } from "@/lib/safe-message";
import { logger } from "@/lib/server/secure-logger";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { resolveSiteOrigin } from "@/lib/server/site-origin";

export const runtime = "nodejs";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
  website: z.string().max(0).optional(),
});

/** POST /api/auth/signup — creates a Supabase account with anti-spam checks. */
export async function POST(request: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      throw new ApiError(
        503,
        "auth_not_configured",
        "Authentication service is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local."
      );
    }

    const ip = getClientIp(request);
    if (!(await checkRateLimit(`signup:${ip}`, 5, 10 * 60_000, { failClosed: true }))) {
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
        emailRedirectTo: `${resolveSiteOrigin(request)}/auth/callback`,
      },
    });

    if (error) {
      logger.error("Signup failed:", error.message);
      const errLower = error.message.toLowerCase();
      if (
        errLower.includes("already registered") ||
        errLower.includes("already been registered") ||
        errLower.includes("already exists")
      ) {
        throw new ApiError(409, "user_already_exists", "That email already has an account. Please sign in instead.");
      }
      if (
        errLower.includes("rate limit") ||
        errLower.includes("too many") ||
        errLower.includes("security purposes")
      ) {
        throw new ApiError(429, "rate_limited", "Rate limit reached. Please wait a few minutes before trying again.");
      }
      if (errLower.includes("signups not allowed") || errLower.includes("disabled")) {
        throw new ApiError(403, "signups_disabled", "Email signups are currently disabled in Supabase project settings.");
      }
      if (errLower.includes("password")) {
        throw new ApiError(400, "weak_password", error.message);
      }
      throw new ApiError(400, "signup_failed", sanitizePublicMessage(error.message, "Could not create account. Please try again."));
    }

    return Response.json({
      ok: true,
      sessionCreated: Boolean(data.session),
    });
  } catch (error) {
    return jsonError(error);
  }
}
