import { z } from "zod";

import { jsonError, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEntitlement, grantEntitlement } from "@/lib/server/entitlements";
import { canonicalPlanId } from "@/lib/plans";
import {
  getOrderStatus,
  getOrderByTenantRef,
  validateAuthoritativeOrderBinding,
  normalizeStatus,
} from "@/lib/payments/uropay";
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

/** GET /api/payments/status — returns the authenticated user's payment status for an orderRef. */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);

    // Each poll can hit UroPay's authoritative endpoint plus DB repair
    // writes. Without a throttle one authenticated user can burn upstream
    // quota and write load at will; the checkout page polls this route.
    // Sized above the checkout page's poll cadence (~22 polls / 5 min) so a
    // paying customer is never locked out while a slow webhook lands.
    if (!(await checkRateLimit(`payment-status:${user.uid}`, 30, 5 * 60_000))) {
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
          currency,
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
    const localStatus = status;

    // Handle order-created-but-not-linked state: if uropay_order_id was not
    // persisted at checkout, reconcile via merchant order reference. Done for
    // expired/failed rows too, so a late payment can still be recovered.
    if (!payment.uropay_order_id) {
      logger.warn("Reconciling unlinked provider order in status check:", {
        orderRef: payment.order_ref,
        paymentId: payment.id,
      });

      try {
        const orderFromRef = await getOrderByTenantRef(payment.order_ref);
        if (orderFromRef) {
          const binding = validateAuthoritativeOrderBinding(orderFromRef, {
            orderRef: payment.order_ref,
            amountPaise: payment.amount,
            currency: payment.currency,
            environment: payment.environment,
          });

          if (binding.valid) {
            const { error: linkError } = await admin
              .from("payments")
              .update({
                uropay_order_id: binding.orderId,
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.id)
              .eq("uid", user.uid);

            if (!linkError) {
              payment.uropay_order_id = binding.orderId;
              logger.info("Successfully linked unlinked payment via tenant reference:", {
                orderRef: payment.order_ref,
                uropayOrderId: binding.orderId,
              });
            }
          }
        }
      } catch (err) {
        logger.warn("Failed to reconcile unlinked order via tenantOrderRef:", err);
      }
    }

    // UroPay documents the webhook as best-effort/advisory and the
    // order GET endpoint as the authoritative source of truth. If the
    // webhook is delayed or never arrives, reconcile the order here.
    // This is what prevents a genuinely PAID order from remaining
    // stuck forever as pending in our database. Expired/failed rows are
    // re-checked too, so a late settlement still grants access.
    if (payment.uropay_order_id) {
      try {
        const authoritativeOrder = await getOrderStatus(
          payment.uropay_order_id
        );

        const binding = validateAuthoritativeOrderBinding(
          authoritativeOrder,
          {
            orderRef: payment.order_ref,
            amountPaise: payment.amount,
            uropayOrderId: payment.uropay_order_id,
            currency: payment.currency,
            environment: payment.environment,
          }
        );

        if (!binding.valid) {
          logger.error(
            "UroPay authoritative binding check failed in status check:",
            {
              orderRef: payment.order_ref,
              error: binding.error,
              detail: binding.detail,
            }
          );

          // A row already closed as expired/failed just keeps that state.
          if (localStatus === "pending" || localStatus === "paid") {
            throw new ApiError(
              409,
              binding.error,
              "The payment details could not be verified with the payment provider."
            );
          }
        } else if (binding.status === "paid" && localStatus !== "paid") {
          // Compare-and-set: pending/expired/failed -> paid only.
          const { data: promoted, error: updateError } = await admin
            .from("payments")
            .update({
              status: "paid",
              uropay_order_id: payment.uropay_order_id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.id)
            .eq("uid", user.uid)
            .in("status", ["pending", "expired", "failed"])
            .select("status")
            .maybeSingle();

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

          if (localStatus !== "pending") {
            logger.warn("Late payment recovery via status check:", {
              paymentId: payment.id,
              previousStatus: localStatus,
            });
          }

          if (promoted) {
            status = "paid";
          } else {
            // Lost a race (e.g. with the webhook): use the stored state.
            const { data: current } = await admin
              .from("payments")
              .select("status")
              .eq("id", payment.id)
              .eq("uid", user.uid)
              .maybeSingle();
            status = normalizeStatus(current?.status) ?? localStatus;
          }
        } else if (binding.status === "refunded") {
          const { error: updateError } = await admin
            .from("payments")
            .update({
              status: "refunded",
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.id)
            .eq("uid", user.uid);

          if (!updateError) {
            status = "refunded";
            logger.info("Payment reconciled to refunded status via status check:", {
              paymentId: payment.id,
            });

            // Revoke entitlement if granted by this payment
            const { data: entitlement } = await admin
              .from("entitlements")
              .select("uid, status, latest_payment_id")
              .eq("uid", user.uid)
              .maybeSingle();

            if (entitlement?.status === "active" && entitlement.latest_payment_id === payment.id) {
              const nowIso = new Date().toISOString();
              await admin
                .from("entitlements")
                .update({
                  status: "expired",
                  expires_at: nowIso,
                  updated_at: nowIso,
                })
                .eq("uid", user.uid);
            }

            // Cancel unpaid referral commission
            await admin
              .from("referral_commissions")
              .update({
                status: "cancelled",
                notes: "Cancelled due to payment refund",
                updated_at: new Date().toISOString(),
              })
              .eq("payment_id", payment.id)
              .eq("status", "unpaid");
          }
        } else if (binding.status !== "paid" && localStatus === "paid") {
          // Never downgrade a paid row from a poll. A paid order that the
          // provider now reports otherwise is a possible reversal and
          // needs manual review, not a silent overwrite.
          logger.error("ALERT: Paid payment unexpectedly reported as non-paid by provider:", {
            paymentId: payment.id,
            providerStatus: binding.status,
          });
          status = "paid";
        } else if (
          (binding.status === "failed" || binding.status === "expired") &&
          localStatus === "pending"
        ) {
          const { error: updateError } = await admin
            .from("payments")
            .update({
              status: binding.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.id)
            .eq("uid", user.uid)
            .eq("status", "pending");

          if (updateError) {
            logger.error("Failed to record terminal payment status:", updateError);
          }
          status = binding.status;
        }
      } catch (error) {
        // Preserve an already-known local state, but don't invent success
        // when UroPay cannot be queried. For a pending payment, a temporary
        // UroPay/API failure simply means the page should keep checking.
        if (error instanceof ApiError) {
          throw error;
        }

        logger.error(
          "UroPay authoritative status check failed:",
          error
        );

        status = localStatus;
        if (localStatus === "pending") {
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

    if (status === "refunded") {
      return Response.json({
        ok: true,
        status: "refunded",
        reason: "payment_refunded",
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
