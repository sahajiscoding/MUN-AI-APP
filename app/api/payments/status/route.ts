import { z } from "zod";

import { jsonError, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEntitlement, grantEntitlement } from "@/lib/server/entitlements";
import { canonicalPlanId } from "@/lib/plans";
import { getOrderStatus } from "@/lib/payments/uropay";
import { processReferralCommission } from "@/lib/referrals";
import { logger } from "@/lib/server/secure-logger";

export const runtime = "nodejs";

const querySchema = z.object({
  orderRef: z
    .string()
    .trim()
    .min(1)
    .max(100),
});

type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired";

/** Normalizes a payment status string to pending/paid/failed/expired. */
function normalizeStatus(value: unknown): PaymentStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  switch (value.trim().toUpperCase()) {
    case "PAID":
      return "paid";
    case "FAILED":
      return "failed";
    case "EXPIRED":
      return "expired";
    case "PENDING":
    case "PROCESSING":
    case "CREATED":
      return "pending";
    default:
      return null;
  }
}

/** GET /api/payments/status — returns the authenticated user's payment status for an orderRef. */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);

    // Each poll can hit UroPay's authoritative endpoint plus DB repair
    // writes. Without a throttle one authenticated user can burn upstream
    // quota and write load at will; the checkout page polls this route.
    if (!(await checkRateLimit(`payment-status:${user.uid}`, 10, 5 * 60_000))) {
      throw new ApiError(
        429,
        "rate_limited",
        "Too many status checks. Please wait a few minutes and try again."
      );
    }

    const url = new URL(request.url);

    const parsed = querySchema.safeParse({
      orderRef: url.searchParams.get("orderRef"),
    });

    if (!parsed.success) {
      throw new ApiError(
        400,
        "invalid_order_reference",
        "A valid payment order reference is required."
      );
    }

    const orderRef = parsed.data.orderRef;
    const admin = supabaseAdmin();

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select(
        `
          id,
          uid,
          order_ref,
          plan_id,
          amount,
          status,
          environment,
          uropay_order_id,
          created_at,
          updated_at
        `
      )
      .eq("order_ref", orderRef)
      .eq("uid", user.uid)
      .maybeSingle();

    if (paymentError) {
      logger.error("Payment status lookup failed:", paymentError);
      throw new ApiError(
        500,
        "payment_lookup_failed",
        "Could not check the payment status."
      );
    }

    if (!payment) {
      throw new ApiError(
        404,
        "payment_not_found",
        "Payment could not be found."
      );
    }

    let status = normalizeStatus(payment.status) ?? "pending";

    // UroPay documents the webhook as best-effort/advisory and the
    // order GET endpoint as the authoritative source of truth. If the
    // webhook is delayed or never arrives, reconcile the order here.
    // This is what prevents a genuinely PAID order from remaining
    // stuck forever as pending in our database.
    if (
      payment.uropay_order_id &&
      (status === "pending" || status === "paid")
    ) {
      try {
        const authoritativeOrder = await getOrderStatus(
          payment.uropay_order_id
        );

        const authoritativeStatus = normalizeStatus(
          authoritativeOrder?.status
        );

        if (!authoritativeStatus) {
          logger.error(
            "UroPay returned an unknown order status:",
            authoritativeOrder?.status
          );
        } else {
          const authoritativeAmount = Number(
            authoritativeOrder?.amount
          );

          const expectedAmountRupees =
            Number(payment.amount) / 100;

          if (
            !Number.isFinite(authoritativeAmount) ||
            authoritativeAmount !== expectedAmountRupees
          ) {
            logger.error(
              "UroPay authoritative amount mismatch:",
              {
                orderRef: payment.order_ref,
                expectedAmountRupees,
                authoritativeAmount,
              }
            );

            throw new ApiError(
              409,
              "payment_amount_mismatch",
              "The payment amount could not be verified."
            );
          }

          status = authoritativeStatus;

          if (status !== "pending") {
            const { error: updateError } = await admin
              .from("payments")
              .update({
                status,
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.id)
              .eq("uid", user.uid);

            if (updateError) {
              logger.error(
                "Failed to reconcile payment status:",
                updateError
              );

              throw new ApiError(
                500,
                "payment_reconciliation_failed",
                "The payment was confirmed, but we could not update your payment record yet."
              );
            }
          }
        }
      } catch (error) {
        // Preserve an already-known paid state, but don't invent success
        // when UroPay cannot be queried. For a pending payment, a temporary
        // UroPay/API failure simply means the page should keep checking.
        if (error instanceof ApiError) {
          throw error;
        }

        logger.error(
          "UroPay authoritative status check failed:",
          error
        );

        if (status !== "paid") {
          return Response.json({
            ok: true,
            status: "pending",
            reason: "payment_status_check_retry",
            orderRef: payment.order_ref,
            planId: canonicalPlanId(payment.plan_id) ?? payment.plan_id,
          });
        }
      }
    }

    // A payment is not enough by itself for the UI to claim that Premium
    // is active. The entitlement must also exist.
    if (status === "paid") {
      let entitlement = await getEntitlement(user.uid);

      const entitlementMatchesPayment =
        entitlement.status === "active" &&
        canonicalPlanId(entitlement.planId) === canonicalPlanId(payment.plan_id);

      if (!entitlementMatchesPayment) {
        // Durable per-payment redemption check: once a payment has extended
        // access, it may never do so again — even if a newer payment has since
        // replaced the entitlement's latest_payment_id pointer.
        const { data: existingGrant, error: grantLookupError } = await supabaseAdmin()
          .from("entitlement_payment_grants")
          .select("payment_id")
          .eq("payment_id", payment.id)
          .maybeSingle();

        if (grantLookupError) {
          logger.error("Payment grant ledger lookup failed:", grantLookupError.message);
        } else if (existingGrant) {
          if (entitlement.status === "active") {
            return Response.json({
              ok: true,
              status: "paid",
              reason: "payment_already_redeemed",
              orderRef: payment.order_ref,
              planId: payment.plan_id,
              expiresAt: entitlement.expiresAt ?? null,
            });
          }
          logger.error("Redeemed payment has no active entitlement:", {
            paymentId: payment.id,
          });
          return Response.json({
            ok: true,
            status: "pending",
            reason: "payment_confirmed_access_processing",
            orderRef: payment.order_ref,
            planId: payment.plan_id,
          });
        }

        try {
          entitlement = await grantEntitlement({
            uid: user.uid,
            planId: canonicalPlanId(payment.plan_id) ?? payment.plan_id,
            source: "uropay-recovery",
            paymentId: payment.id,
            orderId: payment.uropay_order_id ?? payment.order_ref,
          });
        } catch (error) {
          logger.error(
            "Paid payment entitlement recovery failed:",
            error
          );

          return Response.json({
            ok: true,
            status: "pending",
            reason: "payment_confirmed_access_processing",
            orderRef: payment.order_ref,
            planId: canonicalPlanId(payment.plan_id) ?? payment.plan_id,
          });
        }
      }

      const accessConfirmed =
        entitlement.status === "active" &&
        canonicalPlanId(entitlement.planId) === canonicalPlanId(payment.plan_id);

      if (!accessConfirmed) {
        return Response.json({
          ok: true,
          status: "pending",
          reason: "payment_confirmed_access_processing",
          orderRef: payment.order_ref,
          planId: payment.plan_id,
        });
      }

      // The webhook is the primary commission trigger, but UroPay documents it
      // as best-effort. When this poll confirms the payment first (or the
      // webhook never arrives), create the commission here as well. The RPC is
      // idempotent per payment, so a later webhook delivery cannot double-pay.
      try {
        await processReferralCommission({
          uid: user.uid,
          paymentId: payment.id,
          orderId: payment.uropay_order_id ?? payment.order_ref,
          planId: canonicalPlanId(payment.plan_id) ?? payment.plan_id,
          paymentAmountPaise: Number(payment.amount),
        });
      } catch (error) {
        logger.error(
          "Referral commission after confirmed payment failed:",
          error
        );
      }

      return Response.json({
        ok: true,
        status: "paid",
        reason: "payment_confirmed",
        orderRef: payment.order_ref,
        planId: payment.plan_id,
        expiresAt: entitlement.expiresAt ?? null,
      });
    }

    if (status === "failed") {
      return Response.json({
        ok: true,
        status: "failed",
        reason: "payment_failed",
        orderRef: payment.order_ref,
        planId: payment.plan_id,
      });
    }

    if (status === "expired") {
      return Response.json({
        ok: true,
        status: "expired",
        reason: "payment_expired",
        orderRef: payment.order_ref,
        planId: payment.plan_id,
      });
    }

    return Response.json({
      ok: true,
      status: "pending",
      reason: "payment_processing",
      orderRef: payment.order_ref,
      planId: payment.plan_id,
    });
  } catch (error) {
    return jsonError(error);
  }
}
