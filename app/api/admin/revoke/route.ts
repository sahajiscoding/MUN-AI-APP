import { ApiError, jsonError, parseJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/server/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await parseJson<{ uid: string }>(request);

    if (!body.uid) {
      throw new ApiError(400, "missing_uid", "Provide a user UID to revoke.");
    }

    // Remove from admin_users
    const { error } = await supabaseAdmin()
      .from("admin_users")
      .delete()
      .eq("uid", body.uid);

    if (error) throw error;

    // Revoke their entitlement
    await supabaseAdmin()
      .from("entitlements")
      .update({ status: "inactive", plan_id: null, source: "admin_revoke" })
      .eq("uid", body.uid);

    return Response.json({ ok: true, message: "Admin access revoked." });
  } catch (error) {
    return jsonError(error);
  }
}
