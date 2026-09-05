import { ApiError, jsonError, parseJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { recordAdminAction } from "@/lib/server/admin-audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminOwner();
    const body = await parseJson<{ uid: string }>(request);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.uid || "")) {
      throw new ApiError(400, "invalid_uid", "Provide a valid user UID to revoke.");
    }

    if (body.uid.toLowerCase() === admin.uid.toLowerCase()) {
      throw new ApiError(400, "cannot_revoke_self", "You cannot revoke your own administrator access.");
    }

    const { error } = await supabaseAdmin()
      .from("admin_users")
      .delete()
      .eq("uid", body.uid);

    if (error) throw error;

    const { error: entitlementError } = await supabaseAdmin()
      .from("entitlements")
      .update({ status: "inactive", plan_id: null, source: "admin_revoke" })
      .eq("uid", body.uid);
    if (entitlementError) throw entitlementError;

    await recordAdminAction({
      actorUid: admin.uid,
      actorEmail: admin.email,
      action: "admin_revoke",
      targetUid: body.uid,
    });

    return Response.json({ ok: true, message: "Admin access revoked." });
  } catch (error) {
    return jsonError(error);
  }
}
