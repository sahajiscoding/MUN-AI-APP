import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { recordAdminAction } from "@/lib/server/admin-audit";

export const runtime = "nodejs";

const approveSchema = z.object({ uid: z.string().uuid() }).strict();

export async function POST(request: Request) {
  try {
    const admin = await requireAdminOwner();
    const parsed = approveSchema.safeParse(await parseJson<unknown>(request));

    if (!parsed.success) {
      throw new ApiError(400, "invalid_uid", "Provide a valid user UID to approve.");
    }
    const uid = parsed.data.uid;

    // Never create orphan admin rows on a typo: the target must be a real
    // Supabase user.
    const { data: targetUser, error: targetError } = await supabaseAdmin().auth.admin.getUserById(uid);
    if (targetError || !targetUser?.user) {
      throw new ApiError(404, "user_not_found", "No user exists with that UID.");
    }

    const { error } = await supabaseAdmin().from("admin_users").upsert(
      {
        uid,
        approved_at: new Date().toISOString(),
        approved_by: admin.email,
      },
      { onConflict: "uid" }
    );

    if (error) throw error;

    // Grant the admin plan only when it does not destroy something more
    // valuable: an active paid or manually-granted subscription is preserved
    // and the new admin keeps it alongside admin access.
    const { data: existingEntitlement, error: entitlementReadError } = await supabaseAdmin()
      .from("entitlements")
      .select("status, source")
      .eq("uid", uid)
      .maybeSingle();
    if (entitlementReadError) throw entitlementReadError;

    const preservesPaid =
      existingEntitlement?.status === "active" &&
      existingEntitlement.source !== "admin" &&
      existingEntitlement.source !== "admin_revoke";

    if (!preservesPaid) {
      const { error: entitlementError } = await supabaseAdmin().from("entitlements").upsert(
        {
          uid,
          status: "active",
          plan_id: "admin",
          source: "admin",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "uid" }
      );
      if (entitlementError) throw entitlementError;
    }

    await recordAdminAction({
      actorUid: admin.uid,
      actorEmail: admin.email,
      action: "admin_grant",
      targetUid: uid,
      metadata: preservesPaid ? { preserved_subscription: true } : undefined,
    });

    return Response.json({
      ok: true,
      message: preservesPaid
        ? "User approved as admin. Their existing subscription was preserved."
        : "User approved as admin.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
