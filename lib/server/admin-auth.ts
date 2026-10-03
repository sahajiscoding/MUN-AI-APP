import { ApiError } from "@/lib/api";
import { logger } from "@/lib/server/secure-logger";
import { supabaseAdmin } from "@/lib/supabase/server";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
// Short-lived enough to bound a stolen session, long enough for real admin
// work sessions between page loads.
const SESSION_MAX_AGE = 60 * 60 * 4; // 4 hours
const SESSION_ISSUER = "mun-ai-app";
const SESSION_AUDIENCE = "mun-ai-admin";

type AdminSessionClaims = {
  uid: string;
  email: string;
  approvedAt: string;
  sessionVersion: number;
};

export type AdminSession = AdminSessionClaims;

/** Load and validate the admin session signing secret from the environment. */
function getSessionSecret() {
  // Fail closed: ADMIN_SESSION_SECRET is mandatory and must never fall back
  // to SUPABASE_SECRET_KEY (cryptographic separation of duties — the DB
  // master key must not double as a cookie-signing key).
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new ApiError(
      503,
      "admin_not_configured",
      "Administrator access is not configured."
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Build an admin session for an already-approved Supabase user.
 *
 * Admin identity comes from the user's own Supabase account (verified by
 * requireUser against the access token), not from a shared password. A user
 * who is not in admin_users can never obtain an admin session.
 */
export async function adminSessionForUid(uid: string, accessToken: string): Promise<AdminSession> {
  const { data: adminRow, error: adminLookupError } = await supabaseAdmin()
    .from("admin_users")
    .select("uid, approved_at, session_version, revoked_at")
    .eq("uid", uid)
    .is("revoked_at", null)
    .maybeSingle();

  if (adminLookupError || !adminRow) {
    throw new ApiError(
      403,
      "admin_unauthorized",
      "This account is not approved for administrator access."
    );
  }

  const { data: userData, error: userLookupError } = await supabaseAdmin().auth.admin.getUserById(uid);
  const adminEmail = userData?.user?.email;

  if (userLookupError || !adminEmail) {
    throw new ApiError(
      503,
      "admin_not_configured",
      "Administrator access is not configured."
    );
  }

  await assertAdminMfaCompleted(uid, accessToken);

  return {
    uid,
    email: adminEmail,
    approvedAt: adminRow.approved_at || new Date().toISOString(),
    sessionVersion: Number(adminRow.session_version ?? 1),
  };
}

/** Sign admin session claims into a short-lived HS256 JWT. */
async function signAdminSession(session: AdminSession) {
  return new SignJWT({
    uid: session.uid,
    email: session.email,
    approvedAt: session.approvedAt,
    sessionVersion: session.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .sign(getSessionSecret());
}

/** Set a signed, HttpOnly administrator session cookie. */
export async function setAdminSession(session: AdminSession) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, await signAdminSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/**
 * Verify the administrator cookie cryptographically and against the current
 * admin_users table. A deleted/revoked admin cannot keep using an old cookie.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const { payload } = await jwtVerify(raw, getSessionSecret(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });

    if (
      typeof payload.uid !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.approvedAt !== "string" ||
      typeof payload.sessionVersion !== "number"
    ) {
      return null;
    }

    const { data: adminRow, error: adminError } = await supabaseAdmin()
      .from("admin_users")
      .select("uid, session_version, revoked_at")
      .eq("uid", payload.uid)
      .is("revoked_at", null)
      .maybeSingle();
    if (adminError || !adminRow || Number(adminRow.session_version ?? 1) !== payload.sessionVersion) return null;

    return {
      uid: payload.uid,
      email: payload.email,
      approvedAt: payload.approvedAt,
      sessionVersion: payload.sessionVersion,
    };
  } catch {
    return null;
  }
}

/** Require a valid admin session cookie, throwing 401 when absent or invalid. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    throw new ApiError(401, "admin_unauthorized", "Admin login required.");
  }
  return session;
}

/**
 * Whether the UID is a designated owner: one of the ADMIN_OWNER_UIDS values
 * when set, otherwise the first approved admin (the bootstrap account).
 */
export async function isOwnerAdmin(uid: string): Promise<boolean> {
  const ownerUid = uid.trim().toLowerCase();

  const configured = (process.env.ADMIN_OWNER_UIDS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (configured.length > 0) {
    return configured.includes(ownerUid);
  }

  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("uid")
    .is("revoked_at", null)
    .order("approved_at", { ascending: true })
    .limit(1);

  return !error && !!data?.[0] && data[0].uid.toLowerCase() === ownerUid;
}

/**
 * Sensitive actions (grant/revoke admin, partner management, commission
 * settlement) require the account owner, not just any administrator. This
 * stops a compromised or delegated admin from promoting arbitrary accounts.
 */
export async function requireAdminOwner(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (!(await isOwnerAdmin(session.uid))) {
    throw new ApiError(
      403,
      "admin_owner_required",
      "Only the administrator account owner can perform this action."
    );
  }
  return session;
}

/** Clear the administrator session cookie. */
export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Advance an admin's session version, instantly invalidating every issued
 * admin cookie for that account (each request re-checks the live version).
 * Used on logout so a stolen cookie does not survive it, and available for
 * credential-change revocation. Single-session side effect: all of the
 * admin's devices are signed out of the panel together.
 */
export async function bumpAdminSessionVersion(uid: string): Promise<void> {
  const { error } = await supabaseAdmin().rpc("bump_admin_session_version", { p_uid: uid });
  if (error) {
    logger.error("Admin session revocation failed:", error.message);
    throw new ApiError(503, "admin_session_revocation_failed", "Administrator session could not be revoked.");
  }
}

/**
 * Admin promotion requires both an enrolled TOTP factor and proof that this
 * exact Supabase access-token session completed the MFA challenge. Factor
 * inventory alone is not authentication assurance.
 */
export async function assertAdminMfaCompleted(uid: string, accessToken: string): Promise<void> {
  const admin = supabaseAdmin();
  const { data: factors, error: factorsError } = await admin.auth.admin.mfa.listFactors({ userId: uid });
  if (factorsError) {
    logger.error("Could not inspect administrator MFA factors:", factorsError.message);
    throw new ApiError(503, "admin_not_configured", "Administrator access is not configured.");
  }

  const hasVerifiedTotp = (factors?.factors ?? []).some(
    (factor) => factor.status === "verified" && factor.factor_type === "totp"
  );
  if (!hasVerifiedTotp) {
    throw new ApiError(
      403,
      "admin_mfa_required",
      "Protect this administrator account with a verified authenticator app, then sign in again."
    );
  }

  const { data: assurance, error: assuranceError } =
    await admin.auth.mfa.getAuthenticatorAssuranceLevel(accessToken);
  if (assuranceError) {
    logger.error("Could not verify administrator session assurance:", assuranceError.message);
    throw new ApiError(503, "admin_mfa_unavailable", "Administrator MFA could not be verified.");
  }

  if (assurance?.currentLevel !== "aal2") {
    throw new ApiError(
      403,
      "admin_mfa_required",
      "Complete the authenticator challenge before opening the administrator panel."
    );
  }
}

/** Check whether a UID belongs to an active admin user. */
export async function isUserAdmin(uid: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("uid")
    .eq("uid", uid)
    .is("revoked_at", null)
    .limit(1);

  return !error && !!data?.length;
}
