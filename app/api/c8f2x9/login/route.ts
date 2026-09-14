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

export const runtime = "nodejs";

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

    try {
      const session = await adminSessionForUid(user.uid);

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

export async function DELETE() {
  const session = await getAdminSession();
  if (session) {
    await recordAdminAction({
      actorUid: session.uid,
      actorEmail: session.email,
      action: "admin_logout",
    });
    // Revoke server-side, not just client-side: any copied cookie for this
    // account stops working immediately (all devices are signed out together).
    await bumpAdminSessionVersion(session.uid);
  }
  await clearAdminSession();
  return Response.json({ ok: true });
}
