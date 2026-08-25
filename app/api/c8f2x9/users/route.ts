import { jsonError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/server/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();

    const { data: users, error: usersError } = await supabaseAdmin()
      .from("users")
      .select("uid, display_name, email, last_seen_at")
      .order("last_seen_at", { ascending: false });

    if (usersError) throw usersError;

    const { data: entitlements } = await supabaseAdmin()
      .from("entitlements")
      .select("uid, status, plan_id, expires_at");

    const { data: admins } = await supabaseAdmin()
      .from("admin_users")
      .select("uid");

    const adminUids = new Set((admins || []).map((a) => a.uid));
    const entitlementMap = new Map(
      (entitlements || []).map((e) => [e.uid, e])
    );

    const enrichedUsers = (users || []).map((u) => ({
      ...u,
      isAdmin: adminUids.has(u.uid),
      entitlement: entitlementMap.get(u.uid) || { status: "inactive" },
    }));

    return Response.json({ users: enrichedUsers });
  } catch (error) {
    return jsonError(error);
  }
}
