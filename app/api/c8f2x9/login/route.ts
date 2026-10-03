import { ApiError, jsonError } from "@/lib/api";
import {
  adminSessionForUid,
  setAdminSession,
  bumpAdminSessionVersion,
  clearAdminSession,
  getAdminSession,
} from "@/lib/server/admin-auth";
import { requireUser } from "@/lib/server/auth";
import { recordAdminAction } from "@/lib/server/admin-audit";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { logger } from "@/lib/server/secure-logger";

export const runtime = "nodejs";

/** POST /api/c8f2x9/login — establishes an admin session from a verified user token. */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!(await checkRateLimit(`admin-login:${ip}`, 5, 60_000))) {
      throw new ApiError(429, "rate_limited", "Too many login attempts. Try again in a minute.");
    }

    // Admin identity comes from the caller's verified Supabase session, never
    // from a shared password. A non-admin account is rejected here even with
    // a valid sign-in, so there is no password a stranger can learn to
    // escalate with.
    const user = await requireUser(request);
    const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!accessToken) {
      throw new ApiError(401, "invalid_token", "Your session could not be verified.");
    }

    try {
      const session = await adminSessionForUid(user.uid, accessToken);

      await setAdminSession(session);
      await recordAdminAction({
        actorUid: session.uid,
        actorEmail: session.email,
        action: "admin_login",
      });

      return Response.json({ ok: true, admin: { email: session.email } });
    } catch (error) {
      // Keep the MFA-specific error code intact. The admin login page uses
      // this code to show the correct MFA setup/verification popup.
      if (error instanceof ApiError && error.code === "admin_mfa_required") {
        throw error;
      }

      if (error instanceof ApiError && error.status === 403) {
        throw new ApiError(
          403,
          "admin_unauthorized",
          "This account is not approved for administrator access."
        );
      }

      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}

/** DELETE /api/c8f2x9/login — revokes the admin session and clears the cookie. */
export async function DELETE() {
  const session = await getAdminSession();
  let revocationFailed = false;

  if (session) {
    await recordAdminAction({
      actorUid: session.uid,
      actorEmail: session.email,
      action: "admin_logout",
    });
    // Revoke server-side, not just client-side: any copied cookie for this
    // account stops working immediately (all devices are signed out together).
    try {
      await bumpAdminSessionVersion(session.uid);
    } catch (error) {
      revocationFailed = true;
      logger.error(
        "Admin logout could not revoke server-side sessions:",
        error instanceof Error ? error.message : "unknown error"
      );
    }
  }

  // Always clear the local cookie, even when the server-side bump failed;
  // the 503 below tells the caller the session was not fully revoked.
  await clearAdminSession();

  if (revocationFailed) {
    return Response.json(
      { ok: false, error: "Administrator session could not be fully revoked. Please try again." },
      { status: 503 }
    );
  }

  return Response.json({ ok: true });
}
