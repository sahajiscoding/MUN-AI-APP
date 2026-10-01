import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { recordAdminAction } from "@/lib/server/admin-audit";

export const runtime = "nodejs";

const revokeSchema = z.object({ uid: z.string().uuid() }).strict();

export async function POST(request: Request) {
  try {
    const admin = await requireAdminOwner();
    const parsed = revokeSchema.safeParse(await parseJson<unknown>(request));

    if (!parsed.success) {
      throw new ApiError(400, "invalid_uid", "Provide a valid user UID to revoke.");
    }
    const uid = parsed.data.uid;

    if (uid.toLowerCase() === admin.uid.toLowerCase()) {
      throw new ApiError(400, "cannot_revoke_self", "You cannot revoke your own administrator access.");
    }

    const { error } = await supabaseAdmin().rpc("revoke_admin_user", { p_uid: uid });

    if (error) throw error;

    // Removing admin access must not nuke a paid subscription as a side
    // effect: only entitlements that came from admin access itself are
    // wound down. Paid (uropay) and manual grants are left untouched.
    const { data: existing, error: readError } = await supabaseAdmin()
      .from("entitlements")
      .select("source, status")
      .eq("uid", uid)
      .maybeSingle();
    if (readError) throw readError;

    let entitlementTouched = false;
    if (existing && (existing.source === "admin" || existing.source === "admin_revoke")) {
      const { error: entitlementError } = await supabaseAdmin()
        .from("entitlements")
        .update({ status: "inactive", plan_id: null, source: "admin_revoke" })
        .eq("uid", uid);
      if (entitlementError) throw entitlementError;
      entitlementTouched = true;
    }

    await recordAdminAction({
      actorUid: admin.uid,
      actorEmail: admin.email,
      action: "admin_revoke",
      targetUid: uid,
      metadata: { entitlement_touched: entitlementTouched },
    });

    return Response.json({
      ok: true,
      message: entitlementTouched
        ? "Admin access revoked."
        : "Admin access revoked. Their existing subscription was left untouched.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
