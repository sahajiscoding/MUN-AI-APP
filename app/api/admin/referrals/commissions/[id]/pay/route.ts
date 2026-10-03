import { z } from "zod";
import { ApiError, jsonError } from "@/lib/api";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { recordAdminAction } from "@/lib/server/admin-audit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/server/secure-logger";

export const runtime = "nodejs";

const idSchema = z.string().uuid();

/** POST /api/admin/referrals/commissions/[id]/pay — marks an unpaid commission as paid. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminOwner();
    const id = idSchema.safeParse((await params).id);
    if (!id.success) throw new ApiError(400, "invalid_commission_id", "That commission could not be updated.");

    const paidAt = new Date().toISOString();
    const { data, error } = await supabaseAdmin()
      .from("referral_commissions")
      .update({ status: "paid", paid_at: paidAt, updated_at: paidAt })
      .eq("id", id.data)
      .eq("status", "unpaid")
      .select("id, status, paid_at")
      .maybeSingle();

    if (error) {
      logger.error("Commission settlement failed:", error.message);
      throw new ApiError(500, "commission_update_failed", "Could not mark commission as paid.");
    }

    if (data) {
      await recordAdminAction({
        actorUid: admin.uid,
        actorEmail: admin.email,
        action: "commission_pay",
        target: id.data,
        metadata: { status: data.status, paid_at: data.paid_at },
      });
      return Response.json({ commission: data });
    }

    const { data: existing, error: lookupError } = await supabaseAdmin()
      .from("referral_commissions")
      .select("id, status, paid_at")
      .eq("id", id.data)
      .maybeSingle();
    if (lookupError) {
      logger.error("Commission status lookup failed:", lookupError.message);
      throw new ApiError(500, "commission_lookup_failed", "Could not verify commission status.");
    }
    if (!existing) throw new ApiError(404, "commission_not_found", "Commission not found.");
    if (existing.status === "paid") return Response.json({ commission: existing, alreadyPaid: true });
    throw new ApiError(409, "commission_not_payable", "Only unpaid commissions can be marked as paid.");
  } catch (error) {
    return jsonError(error);
  }
}
