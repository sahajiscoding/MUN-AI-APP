import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { recordAdminAction } from "@/lib/server/admin-audit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { logger } from "@/lib/server/secure-logger";

export const runtime = "nodejs";

const idSchema = z.string().uuid();
const bodySchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

/**
 * POST /api/admin/payments/[id]/refund
 *
 * Owner-only route to record a refund/chargeback on a payment.
 * Revokes active premium access if tied to this payment, voids any unpaid
 * referral commission, and logs an audited administrative action.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminOwner();

    const ip = getClientIp(request);
    if (
      !(await checkRateLimit(`admin-refund:${admin.uid}`, 10, 60_000, { failClosed: true })) ||
      !(await checkRateLimit(`admin-refund-ip:${ip}`, 20, 60_000, { failClosed: true }))
    ) {
      throw new ApiError(429, "rate_limited", "Too many refund operations. Please try again later.");
    }

    const { id: rawId } = await params;
    const parsedId = idSchema.safeParse(rawId);
    if (!parsedId.success) {
      throw new ApiError(400, "invalid_payment_id", "A valid payment UUID is required.");
    }
    const paymentId = parsedId.data;

    let body = { reason: "" };
    try {
      const parsedBody = bodySchema.safeParse(await parseJson<unknown>(request));
      if (parsedBody.success) {
        body = { reason: parsedBody.data.reason || "" };
      }
    } catch {
      // Empty body is acceptable
    }

    const db = supabaseAdmin();

    const { data: payment, error: paymentLookupError } = await db
      .from("payments")
      .select("id, uid, order_ref, uropay_order_id, status, amount, plan_id")
      .eq("id", paymentId)
      .maybeSingle();

    if (paymentLookupError) {
      logger.error("Payment lookup for refund failed:", paymentLookupError.message);
      throw new ApiError(500, "database_error", "Could not check payment record.");
    }

    if (!payment) {
      throw new ApiError(404, "payment_not_found", "Payment record not found.");
    }

    if (payment.status === "refunded") {
      return Response.json({
        ok: true,
        message: "Payment was already marked as refunded.",
        alreadyRefunded: true,
      });
    }

    const nowIso = new Date().toISOString();

    // 1. Mark payment as refunded
    const { error: updateError } = await db
      .from("payments")
      .update({
        status: "refunded",
        updated_at: nowIso,
      })
      .eq("id", payment.id);

    if (updateError) {
      logger.error("Payment refund update failed:", updateError.message);
      throw new ApiError(500, "update_failed", "Could not mark payment as refunded.");
    }

    // 2. Revoke entitlement if granted by this payment
    let entitlementRevoked = false;
    const { data: entitlement } = await db
      .from("entitlements")
      .select("uid, status, latest_payment_id")
      .eq("uid", payment.uid)
      .maybeSingle();

    if (
      entitlement &&
      entitlement.status === "active" &&
      entitlement.latest_payment_id === payment.id
    ) {
      const { error: revokeError } = await db
        .from("entitlements")
        .update({
          status: "expired",
          expires_at: nowIso,
          updated_at: nowIso,
        })
        .eq("uid", payment.uid);

      if (revokeError) {
        logger.error("Entitlement revocation on admin refund failed:", revokeError.message);
      } else {
        entitlementRevoked = true;
      }
    }

    // 3. Void any unpaid referral commission
    let commissionCancelled = false;
    const { data: cancelledCommission } = await db
      .from("referral_commissions")
      .update({
        status: "cancelled",
        notes: body.reason ? `Admin refund: ${body.reason}` : "Cancelled by admin refund",
        updated_at: nowIso,
      })
      .eq("payment_id", payment.id)
      .eq("status", "unpaid")
      .select("id")
      .maybeSingle();

    if (cancelledCommission) {
      commissionCancelled = true;
    }

    // 4. Record admin audit action
    await recordAdminAction({
      actorUid: admin.uid,
      actorEmail: admin.email,
      action: "payment_refund",
      target: payment.id,
      targetUid: payment.uid,
      metadata: {
        orderRef: payment.order_ref,
        uropayOrderId: payment.uropay_order_id,
        amount: payment.amount,
        planId: payment.plan_id,
        previousStatus: payment.status,
        reason: body.reason || null,
        entitlementRevoked,
        commissionCancelled,
      },
    });

    return Response.json({
      ok: true,
      message: "Payment marked as refunded.",
      entitlementRevoked,
      commissionCancelled,
    });
  } catch (error) {
    return jsonError(error);
  }
}
