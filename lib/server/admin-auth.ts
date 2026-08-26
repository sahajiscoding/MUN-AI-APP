import { timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours
const SESSION_ISSUER = "mun-ai-app";
const SESSION_AUDIENCE = "mun-ai-admin";

type AdminSessionClaims = {
  uid: string;
  email: string;
  approvedAt: string;
};

export type AdminSession = AdminSessionClaims;

function getAdminPassword() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new ApiError(
      503,
      "admin_not_configured",
      "Administrator access is not configured."
    );
  }
  return password;
}

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SECRET_KEY;
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
 * Verify the administrator password and create a session for an already
 * approved Supabase admin. Admins must be provisioned deliberately; this
 * endpoint never creates a default account or uses a fallback password.
 */
export async function adminLogin(password: string): Promise<AdminSession> {
  const configuredPassword = Buffer.from(getAdminPassword());
  const suppliedPassword = Buffer.from(password);
  if (configuredPassword.length !== suppliedPassword.length || !timingSafeEqual(configuredPassword, suppliedPassword)) {
    throw new ApiError(401, "invalid_password", "Incorrect admin password.");
  }

  const { data: admins, error: adminLookupError } = await supabaseAdmin()
    .from("admin_users")
    .select("uid, approved_at")
    .order("approved_at", { ascending: true })
    .limit(1);

  if (adminLookupError || !admins?.[0]?.uid) {
    throw new ApiError(
      503,
      "admin_not_configured",
      "Administrator access is not configured."
    );
  }

  const adminUid = admins[0].uid;
  const { data: userData, error: userLookupError } = await supabaseAdmin().auth.admin.getUserById(adminUid);
  const adminEmail = userData?.user?.email;

  if (userLookupError || !adminEmail) {
    throw new ApiError(
      503,
      "admin_not_configured",
      "Administrator access is not configured."
    );
  }

  return {
    uid: adminUid,
    email: adminEmail,
    approvedAt: admins[0].approved_at || new Date().toISOString(),
  };
}

async function signAdminSession(session: AdminSession) {
  return new SignJWT({
    uid: session.uid,
    email: session.email,
    approvedAt: session.approvedAt,
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
      typeof payload.approvedAt !== "string"
    ) {
      return null;
    }

    const isAdmin = await isUserAdmin(payload.uid);
    if (!isAdmin) return null;

    return {
      uid: payload.uid,
      email: payload.email,
      approvedAt: payload.approvedAt,
    };
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    throw new ApiError(401, "admin_unauthorized", "Admin login required.");
  }
  return session;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isUserAdmin(uid: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("uid")
    .eq("uid", uid)
    .limit(1);

  return !error && !!data?.length;
}
