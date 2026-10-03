import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/server/secure-logger";

export const runtime = "nodejs";

/** Resolves a safe post-login redirect path within the same origin. */
function getSafeNext(value: string | null, origin: string) {
  if (!value) return "/dashboard";
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/") || url.pathname.startsWith("//")) return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}

/** Redirects to sign-in after logging an OAuth callback failure. */
function failureRedirect(origin: string, reason: string) {
  logger.error("OAuth callback failed:", { reason });
  return NextResponse.redirect(new URL("/auth/signin?error=oauth_callback_failed", origin));
}

/** Handles the OAuth callback and exchanges the code for a session. */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  logger.info("OAuth callback reached:", { hasCode: Boolean(requestUrl.searchParams.get("code")) });

  const oauthError = requestUrl.searchParams.get("error");
  if (oauthError) {
    return failureRedirect(requestUrl.origin, `provider_error:${oauthError.slice(0, 120)}`);
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) return failureRedirect(requestUrl.origin, "missing_code");

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failureRedirect(requestUrl.origin, `exchange:${error.message.slice(0, 160)}`);

    const destination = getSafeNext(requestUrl.searchParams.get("next"), requestUrl.origin);
    logger.info("OAuth callback exchange succeeded:", { destination });
    return NextResponse.redirect(new URL(destination, requestUrl.origin));
  } catch (error) {
    return failureRedirect(requestUrl.origin, error instanceof Error ? error.message.slice(0, 160) : "unexpected_error");
  }
}
