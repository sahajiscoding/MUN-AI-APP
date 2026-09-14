import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { recordAdminAction } from "@/lib/server/admin-audit";

export const runtime = "nodejs";

const revokeSubscriptionSchema = z.object({ uid: z.string().uuid() }).strict();

/**
 * Ends a subscription that was granted manually from the admin panel.
 *
 * Deliberately scoped: only entitlements with source "admin_manual" can be
 * revoked here, so a mis-click can never cancel a paid (UroPay) subscription
 * or admin access. Revoking expires the row in place (status + expires_at),
 * preserving the history row instead of deleting it, and is audit-logged.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdminOwner();
    const parsed = revokeSubscriptionSchema.safeParse(await parseJson<unknown>(request));

    if (!parsed.success) {
      throw new ApiError(400, "invalid_uid", "Provide a valid user UID to revoke a subscription.");
    }
    const body = parsed.data;

    const { data: existing, error: fetchError } = await supabaseAdmin()
      .from("entitlements")
      .select("uid, status, plan_id, source")
      .eq("uid", body.uid)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!existing) {
      throw new ApiError(404, "no_entitlement", "This user has no subscription to revoke.");
    }

    if (existing.source !== "admin_manual") {
      throw new ApiError(
        409,
        "not_manual_grant",
        "Only subscriptions granted manually from this panel can be revoked here."
      );
    }

    if (existing.status === "expired") {
      return Response.json({ ok: true, message: "This subscription was already revoked." });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin()
      .from("entitlements")
      .update({ status: "expired", expires_at: now, updated_at: now })
      .eq("uid", body.uid);

    if (updateError) throw updateError;

    await recordAdminAction({
      actorUid: admin.uid,
      actorEmail: admin.email,
      action: "subscription_revoke",
      targetUid: body.uid,
      metadata: { planId: existing.plan_id ?? null },
    });

    return Response.json({ ok: true, message: "Subscription revoked." });
  } catch (error) {
    return jsonError(error);
  }
}