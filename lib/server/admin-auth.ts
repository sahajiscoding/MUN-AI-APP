import { ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "AGGIN";
const COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

export type AdminSession = {
  uid: string;
  email: string;
  approvedAt: string;
};

/**
 * Verify admin password and create session
 */
export async function adminLogin(password: string): Promise<AdminSession> {
  if (password !== ADMIN_PASSWORD) {
    throw new ApiError(401, "invalid_password", "Incorrect admin password.");
  }

  // Use a service-role query to get all admin users
  const { data: admins, error } = await supabaseAdmin()
    .from("admin_users")
    .select("uid, approved_at")
    .limit(1);

  if (error || !admins || admins.length === 0) {
    throw new ApiError(403, "no_admins", "No admin users configured. Run the SQL schema first.");
  }

  // For simplicity, use the first admin user
  const admin = admins[0];

  // Get user email from auth
  const { data: userData } = await supabaseAdmin().auth.admin.getUserById(admin.uid);

  return {
    uid: admin.uid,
    email: userData?.user?.email || "admin@munprep.app",
    approvedAt: admin.approved_at,
  };
}

/**
 * Set admin session cookie
 */
export async function setAdminSession(session: AdminSession) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/**
 * Get admin session from cookie
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

/**
 * Require valid admin session
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    throw new ApiError(401, "admin_unauthorized", "Admin login required.");
  }
  return session;
}

/**
 * Clear admin session
 */
export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Check if a user UID is an approved admin
 */
export async function isUserAdmin(uid: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("admin_users")
    .select("uid")
    .eq("uid", uid)
    .limit(1);

  return !!(data && data.length > 0);
}
