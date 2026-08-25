import { ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "AGGIN";
const COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours
const DEFAULT_ADMIN_UID = "00000000-0000-0000-0000-000000000001";

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

  // Try to get an existing admin user
  let adminUid: string;
  let adminEmail: string;

  const { data: admins } = await supabaseAdmin()
    .from("admin_users")
    .select("uid")
    .limit(1);

  if (admins && admins.length > 0) {
    // Use existing admin
    adminUid = admins[0].uid;
    const { data: userData } = await supabaseAdmin().auth.admin.getUserById(adminUid);
    adminEmail = userData?.user?.email || "admin@munprep.app";
  } else {
    // No admins exist yet — create a default admin user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin().auth.admin.createUser({
      email: "admin@munprep.app",
      password: "admin-temp-password-change-me",
      email_confirm: true,
      user_metadata: { full_name: "Admin" },
    });

    if (authError || !authData?.user) {
      // If user already exists, try to get it
      const { data: existingUsers } = await supabaseAdmin().auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u) => u.email === "admin@munprep.app");

      if (existing) {
        adminUid = existing.id;
        adminEmail = existing.email || "admin@munprep.app";
      } else {
        // Last resort: use a fixed UID
        adminUid = DEFAULT_ADMIN_UID;
        adminEmail = "admin@munprep.app";
      }
    } else {
      adminUid = authData.user.id;
      adminEmail = authData.user.email || "admin@munprep.app";
    }

    // Insert into admin_users table (ignore if fails)
    await supabaseAdmin().from("admin_users").upsert(
      {
        uid: adminUid,
        approved_at: new Date().toISOString(),
        approved_by: "system",
      },
      { onConflict: "uid" }
    );

    // Also grant active entitlement
    await supabaseAdmin().from("entitlements").upsert(
      {
        uid: adminUid,
        status: "active",
        plan_id: "admin",
        source: "admin",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "uid" }
    );
  }

  return {
    uid: adminUid,
    email: adminEmail,
    approvedAt: new Date().toISOString(),
  };
}

/**
 * Set admin session cookie
 */
export async function setAdminSession(session: AdminSession) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    secure: true,
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
